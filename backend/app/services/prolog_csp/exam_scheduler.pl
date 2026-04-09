:- dynamic scheduled/6.
:- dynamic best_result/3.
:- use_module(library(time)).

:- dynamic exam/4.
:- dynamic room/2.
:- dynamic slot/1.
:- dynamic slot_day/2.
:- dynamic slot_rank/2.
:- dynamic slot_code/2.
:- dynamic exam_slot/2.
:- dynamic preferred_exam_slot/2.
:- dynamic reserved_room_slot/2.
:- dynamic student_conflict/2.
:- dynamic constraint_no_same_program_year_day_timeslot/1.
:- dynamic constraint_no_student_overlap/1.
:- dynamic constraint_room_capacity_check/1.
:- dynamic constraint_prefer_day_timeslot/1.
:- dynamic constraint_allow_flexible_fallback/1.
:- dynamic constraint_minimize_same_program_year_same_day/1.

% Safe optimistic upper bound per exam for branch-and-bound pruning.
% Components upper bound: preferred(700) + day spread(1500) + year align(45)
% + slot balance(90) + day order(~500) => < 3000.
max_soft_per_exam(3000).

solve(true).
solve((A, B)) :-
    solve(A),
    solve(B).
solve((Cond -> Then ; Else)) :-
    !,
    (solve(Cond) -> solve(Then) ; solve(Else)).
solve((Cond -> Then)) :-
    !,
    (solve(Cond) -> solve(Then)).
solve((A ; B)) :-
    !,
    (solve(A) ; solve(B)).
solve(\+ Goal) :-
    \+ solve(Goal).
solve(solve(Goal)) :-
    !,
    solve(Goal).
solve(Goal) :-
    (
        predicate_property(Goal, built_in)
    ;
        predicate_property(Goal, foreign)
    ;
        predicate_property(Goal, imported_from(_))
    ),
    !,
    call(Goal).
solve(Goal) :-
    clause(Goal, Body),
    solve(Body).

% ---------- Domain helpers ----------

is_preferred(Exam, Slot) :- preferred_exam_slot(Exam, Slot).
has_preferred(Exam) :- preferred_exam_slot(Exam, _).

% ---------- Hard constraints (must always hold) ----------

% Exam must fit room capacity. Capacity is treated as a fixed hard rule.
capacity_ok(Exam, Room) :-
    exam(Exam, _, _, Required),
    room(Room, Capacity),
    Capacity >= Required.

room_slot_available(Room, Slot) :-
    \+ scheduled(_, _, _, Room, Slot, _),
    \+ reserved_room_slot(Room, Slot).

% Same program-year cannot have two exams in the same day-timeslot.
program_year_slot_available(Program, Year, Slot) :-
    \+ scheduled(_, Program, Year, _, Slot, _).

% Two exams with a student-conflict edge cannot share the same slot.
student_slot_available(Exam, Slot) :-
    \+ (
        scheduled(OtherExam, _, _, _, Slot, _),
        (student_conflict(Exam, OtherExam) ; student_conflict(OtherExam, Exam))
    ).

% Master hard-feasibility predicate for one candidate assignment.
hard_constraints_ok(Exam, Program, Year, Room, Slot) :-
    solve((
        exam_slot(Exam, Slot),
        room(Room, _),
        capacity_ok(Exam, Room),
        room_slot_available(Room, Slot),
        program_year_slot_available(Program, Year, Slot),
        student_slot_available(Exam, Slot)
    )).

% Strict mode only enforces preferred slots for exams that declare preferences.
strict_soft_ok(Exam, _Program, _Year, Slot) :-
    (has_preferred(Exam) -> preferred_exam_slot(Exam, Slot) ; true).

% ---------- Load/shape metrics used by soft scoring ----------

same_day_load_for_program_year(Program, Year, Slot, Load) :-
    slot_day(Slot, Day),
    findall(
        1,
        (
            scheduled(_, Program, Year, _, OtherSlot, _),
            slot_day(OtherSlot, Day)
        ),
        Marks
    ),
    length(Marks, Load).

same_year_day_cross_program_load(Program, Year, Slot, Load) :-
    slot_day(Slot, Day),
    findall(
        1,
        (
            scheduled(_, OtherProgram, Year, _, OtherSlot, _),
            OtherProgram \= Program,
            slot_day(OtherSlot, Day)
        ),
        Marks
    ),
    length(Marks, Load).

same_day_slotcode_load(Slot, Load) :-
    slot_day(Slot, Day),
    slot_code(Slot, SlotCode),
    findall(
        1,
        (
            scheduled(_, _, _, _, OtherSlot, _),
            slot_day(OtherSlot, Day),
            slot_code(OtherSlot, SlotCode)
        ),
        Marks
    ),
    length(Marks, Load).

% ---------- Soft constraints (optimize quality, do not reject validity) ----------

% Higher score is better. Hard constraints are checked separately and never scored here.
soft_score(Exam, Program, Year, Slot, Score) :-
    % 1) Preference satisfaction bonus:
    % Reward assignments that match explicit preferred_exam_slot/2 facts.
    % No penalty is applied here for non-preferred assignments; strict mode handles enforcement.
    (
        is_preferred(Exam, Slot)
    ->
        PreferredBonus = 700
    ;
        PreferredBonus = 0
    ),

    % 2) Program-year same-day spreading:
    % Strongly encourage at most one exam per program-year per day.
    % - If none exists on that day: large bonus.
    % - If already present: large negative penalty per existing same-day exam.
    (
        same_day_load_for_program_year(Program, Year, Slot, SameDayLoad),
        (
            SameDayLoad =:= 0
        ->
            DaySpreadBonus = 1500
        ;
            % Penalize duplicate same-day exams for the same program-year heavily.
            DaySpreadBonus is -1800 * SameDayLoad
        )
    ),

    % 3) Cross-program same-year day alignment:
    % Small bonus when the same year from other programs already has exams that day.
    % This nudges a coherent "same-year exam day" pattern across programs.
    (
        same_year_day_cross_program_load(Program, Year, Slot, CrossProgramSameYearDayLoad),
        (CrossProgramSameYearDayLoad > 0 -> YearAlignmentBonus = 45 ; YearAlignmentBonus = 0)
    ),

    % 4) Day/slot-code balancing:
    % Prefer less crowded sessions (e.g., morning-exam vs afternoon-exam) on the same day.
    % Bonus linearly decays as load increases and floors at zero.
    (
        same_day_slotcode_load(Slot, SameSlotCodeLoad),
        RawTimeslotBalanceBonus is 90 - SameSlotCodeLoad * 15,
        (RawTimeslotBalanceBonus > 0 -> TimeslotBalanceBonus = RawTimeslotBalanceBonus ; TimeslotBalanceBonus = 0)
    ),

    % 5) Chronological slot bias:
    % Prefer earlier ranked slots via slot_rank/2. If rank is unavailable, no effect.
    (slot_rank(Slot, Rank) -> DayOrderBonus is 500 - Rank ; DayOrderBonus = 0),

    % Final soft objective is the sum of all components above.
    Score is PreferredBonus + DaySpreadBonus + YearAlignmentBonus + TimeslotBalanceBonus + DayOrderBonus.

% Candidate generation modes:
% strict  -> hard constraints + strict preferred-slot compliance.
% relaxed -> hard constraints only; soft score guides ranking.
candidate(mode(strict), Exam, Program, Year, Room, Slot, SoftScore) :-
    hard_constraints_ok(Exam, Program, Year, Room, Slot),
    strict_soft_ok(Exam, Program, Year, Slot),
    soft_score(Exam, Program, Year, Slot, SoftScore).

candidate(mode(relaxed), Exam, Program, Year, Room, Slot, SoftScore) :-
    hard_constraints_ok(Exam, Program, Year, Room, Slot),
    soft_score(Exam, Program, Year, Slot, SoftScore).

% Build and sort candidate domain for one exam under current partial schedule.
candidate_domain(Mode, Exam, Program, Year, Domain) :-
    findall(
        cand(Room, Slot, SoftScore),
        candidate(Mode, Exam, Program, Year, Room, Slot, SoftScore),
        RawDomain
    ),
    sort_candidates_best_first(RawDomain, Domain).

sort_candidates_best_first(Domain, Sorted) :-
    findall(cand(R, S, P), member(cand(R, S, P), Domain), Raw),
    predsort(compare_candidate, Raw, Sorted).

% Candidate tie-break order:
% 1) higher soft score
% 2) earlier slot rank
compare_candidate(Delta, cand(_, Slot1, Score1), cand(_, Slot2, Score2)) :-
    compare(ScoreOrd, Score2, Score1),
    (
        ScoreOrd \= (=)
    ->
        Delta = ScoreOrd
    ;
        (
            slot_rank(Slot1, Rank1),
            slot_rank(Slot2, Rank2),
            compare(RankOrd, Rank1, Rank2),
            (RankOrd = (=) -> Delta = (=) ; Delta = RankOrd)
        )
    ).

scheduled_load_for_program_year(Program, Year, Load) :-
    findall(1, scheduled(_, Program, Year, _, _, _), Marks),
    length(Marks, Load).

scheduled_load_for_program(Program, Load) :-
    findall(1, scheduled(_, Program, _, _, _, _), Marks),
    length(Marks, Load).

scheduled_load_for_year(Year, Load) :-
    findall(1, scheduled(_, _, Year, _, _, _), Marks),
    length(Marks, Load).

sort_by_mcv(_, [], []).
% Most-constrained-exam-first ordering with deterministic tie-breakers.
sort_by_mcv(Mode, Exams, SortedExams) :-
    findall(
        Count-YearLoad-ProgramLoad-ProgramYearLoad-Exam,
        (
            member(Exam, Exams),
            exam(Exam, Program, Year, _),
            candidate_domain(Mode, Exam, Program, Year, Domain),
            length(Domain, Count),
            scheduled_load_for_year(Year, YearLoad),
            scheduled_load_for_program(Program, ProgramLoad),
            scheduled_load_for_program_year(Program, Year, ProgramYearLoad)
        ),
        Pairs
    ),
    keysort(Pairs, SortedPairs),
    pairs_values(SortedPairs, SortedExams).

pairs_values([], []).
pairs_values([_-_-Value|Rest], [Value|Values]) :-
    pairs_values(Rest, Values).

% Forward-checking guard: all remaining exams must have non-empty domains.
remaining_feasible(_, []).
remaining_feasible(Mode, [Exam|Rest]) :-
    exam(Exam, Program, Year, _),
    candidate_domain(Mode, Exam, Program, Year, Domain),
    Domain \= [],
    remaining_feasible(Mode, Rest).

reset_best :- retractall(best_result(_, _, _)).

% Greedy warm-start provides an early best_result for stronger pruning.
greedy_seed(Mode, Exams) :-
    retractall(scheduled(_, _, _, _, _, _)),
    greedy_assign_linear(Mode, Exams, 0, 0, Assigned, Soft, SeedSchedule),
    update_best_with_schedule(Assigned, Soft, SeedSchedule),
    retractall(scheduled(_, _, _, _, _, _)).

greedy_assign_linear(_, [], Assigned, Soft, Assigned, Soft, SeedSchedule) :-
    snapshot_schedule(SeedSchedule).
% Linear greedy assignment using top-ranked candidate per exam.
greedy_assign_linear(Mode, [Exam|Others], AssignedIn, SoftIn, AssignedOut, SoftOut, SeedSchedule) :-
    exam(Exam, Program, Year, _),
    candidate_domain(Mode, Exam, Program, Year, Domain),
    (
        Domain = [cand(Room, Slot, PreferredScore)|_]
    ->
        assertz(scheduled(Exam, Program, Year, Room, Slot, PreferredScore)),
        NextAssigned is AssignedIn + 1,
        NextSoft is SoftIn + PreferredScore,
        greedy_assign_linear(Mode, Others, NextAssigned, NextSoft, AssignedOut, SoftOut, SeedSchedule),
        retract(scheduled(Exam, Program, Year, Room, Slot, PreferredScore))
    ;
        greedy_assign_linear(Mode, Others, AssignedIn, SoftIn, AssignedOut, SoftOut, SeedSchedule)
    ).

snapshot_schedule(List) :-
    findall(
        scheduled(Exam, Program, Year, Room, Slot, PreferredScore),
        scheduled(Exam, Program, Year, Room, Slot, PreferredScore),
        List
    ).

% Better result policy:
% 1) maximize assigned exams
% 2) if tie, maximize total soft score
better_than_best(Assigned, Soft, BestAssigned, BestSoft) :-
    Assigned > BestAssigned ;
    (Assigned =:= BestAssigned, Soft > BestSoft).

update_best(Assigned, Soft) :-
    snapshot_schedule(ScheduleList),
    update_best_with_schedule(Assigned, Soft, ScheduleList).

% Replace best_result/3 only when strictly better than current best.
update_best_with_schedule(Assigned, Soft, ScheduleList) :-
    (
        best_result(BestAssigned, BestSoft, _) ->
            (better_than_best(Assigned, Soft, BestAssigned, BestSoft) ->
                retractall(best_result(_, _, _)),
                assertz(best_result(Assigned, Soft, ScheduleList))
            ;
                true
            )
    ;
        assertz(best_result(Assigned, Soft, ScheduleList))
    ).

% Materialize best result back into scheduled/6 for final printing.
apply_best_schedule :-
    retractall(scheduled(_, _, _, _, _, _)),
    (best_result(_, _, BestSchedule) ->
        forall(
            member(scheduled(Exam, Program, Year, Room, Slot, PreferredScore), BestSchedule),
            assertz(scheduled(Exam, Program, Year, Room, Slot, PreferredScore))
        )
    ;
        true
    ).

% Full-search pruning: if optimistic bound cannot beat current full best, prune.
full_soft_prunable(Soft, RemainingCount, TargetCount) :-
    best_result(BestAssigned, BestSoft, _),
    BestAssigned =:= TargetCount,
    max_soft_per_exam(MaxSoft),
    OptimisticSoft is Soft + (RemainingCount * MaxSoft),
    OptimisticSoft =< BestSoft.

search_full_best_soft(_, _, [], Assigned, Soft) :-
    update_best(Assigned, Soft).
% Full search explores complete assignments only; no skipping.
search_full_best_soft(Mode, TargetCount, Remaining, Assigned, Soft) :-
    length(Remaining, RemainingCount),
    (full_soft_prunable(Soft, RemainingCount, TargetCount) ->
        true
    ;
        sort_by_mcv(Mode, Remaining, [Exam|Others]),
        exam(Exam, Program, Year, _),
        candidate_domain(Mode, Exam, Program, Year, Domain),
        Domain \= [],
        member(cand(Room, Slot, PreferredScore), Domain),
        assertz(scheduled(Exam, Program, Year, Room, Slot, PreferredScore)),
        NextAssigned is Assigned + 1,
        NextSoft is Soft + PreferredScore,
        remaining_feasible(Mode, Others),
        search_full_best_soft(Mode, TargetCount, Others, NextAssigned, NextSoft),
        retract(scheduled(Exam, Program, Year, Room, Slot, PreferredScore)),
        fail
    ;
        true
    ).

% Partial-search pruning for best-effort fallback mode.
partial_prunable(Assigned, Soft, RemainingCount) :-
    best_result(BestAssigned, BestSoft, _),
    MaxPossibleAssigned is Assigned + RemainingCount,
    max_soft_per_exam(MaxSoft),
    OptimisticSoft is Soft + (RemainingCount * MaxSoft),
    (
        MaxPossibleAssigned < BestAssigned
    ;
        MaxPossibleAssigned =:= BestAssigned,
        OptimisticSoft =< BestSoft
    ).

search_partial_best(_, [], Assigned, Soft) :-
    update_best(Assigned, Soft).
% Partial search may skip unschedulable exams to maximize assignment count.
search_partial_best(Mode, Remaining, Assigned, Soft) :-
    length(Remaining, RemainingCount),
    (partial_prunable(Assigned, Soft, RemainingCount) ->
        true
    ;
        sort_by_mcv(Mode, Remaining, [Exam|Others]),
        exam(Exam, Program, Year, _),
        candidate_domain(Mode, Exam, Program, Year, Domain),
        (
            member(cand(Room, Slot, PreferredScore), Domain),
            assertz(scheduled(Exam, Program, Year, Room, Slot, PreferredScore)),
            NextAssigned is Assigned + 1,
            NextSoft is Soft + PreferredScore,
            search_partial_best(Mode, Others, NextAssigned, NextSoft),
            retract(scheduled(Exam, Program, Year, Room, Slot, PreferredScore)),
            fail
        ;
            search_partial_best(Mode, Others, Assigned, Soft)
        )
    ;
        true
    ).

% Time-bounded wrappers keep solver responsive under wall-clock budgets.
try_full_with_timeout(Mode, Exams, TargetCount, Seconds) :-
    catch(
        call_with_time_limit(Seconds, search_full_best_soft(Mode, TargetCount, Exams, 0, 0)),
        _,
        true
    ).

try_partial_with_timeout(Mode, Exams, Seconds) :-
    catch(
        call_with_time_limit(Seconds, search_partial_best(Mode, Exams, 0, 0)),
        _,
        true
    ).

% Compute remaining wall-clock budget.
remaining_seconds(StartTime, TotalSeconds, RemainingSeconds) :-
    get_time(Now),
    LeftFloat is TotalSeconds - (Now - StartTime),
    (
        LeftFloat =< 0
    ->
        RemainingSeconds = 0
    ;
        RemainingSeconds is ceiling(LeftFloat)
    ).

% Clamp requested phase budget by actual remaining total budget.
bounded_phase_budget(StartTime, TotalSeconds, RequestedSeconds, PhaseBudget) :-
    remaining_seconds(StartTime, TotalSeconds, Remaining),
    (
        Remaining =< 0
    ->
        PhaseBudget = 0
    ;
        (
            Remaining < RequestedSeconds
        ->
            PhaseBudget = Remaining
        ;
            PhaseBudget = RequestedSeconds
        )
    ).

% Output format consumed by Python wrapper parser.
print_schedule :-
    forall(
        scheduled(Exam, Program, Year, Room, Slot, PreferredScore),
        format('~q\t~q\t~q\t~q\t~q\t~q~n', [Exam, Program, Year, Room, Slot, PreferredScore])
    ).

% Main orchestration pipeline (fixed policy, no frontend flag branching):
% 1) reset state
% 2) greedy seed
% 3) strict full search
% 4) relaxed full search if strict is incomplete
% 5) relaxed partial search if still incomplete
% 6) apply and print best result
solve_and_print(TimeoutSeconds) :-
    retractall(scheduled(_, _, _, _, _, _)),
    reset_best,
    findall(Exam, exam(Exam, _, _, _), Exams),
    length(Exams, TargetCount),

    % Seed a quick feasible baseline so timeout still returns useful partial output.
    greedy_seed(mode(relaxed), Exams),
    % Start phase budgeting after greedy so strict/relaxed/partial keep full configured budget.
    get_time(StartTime),

    (
        bounded_phase_budget(StartTime, TimeoutSeconds, 50, StrictBudget),
        StrictBudget > 0
    ->
        try_full_with_timeout(mode(strict), Exams, TargetCount, StrictBudget)
    ;
        true
    ),

    (
        best_result(TargetCount, _, _)
    ->
        true
    ;
        (
            bounded_phase_budget(StartTime, TimeoutSeconds, 30, RelaxedBudget),
            RelaxedBudget > 0
        ->
            try_full_with_timeout(mode(relaxed), Exams, TargetCount, RelaxedBudget)
        ;
            true
        )
    ),

    (
        best_result(TargetCount, _, _)
    ->
        true
    ;
        (
            bounded_phase_budget(StartTime, TimeoutSeconds, 20, PartialBudget),
            PartialBudget > 0
        ->
            try_partial_with_timeout(mode(relaxed), Exams, PartialBudget)
        ;
            true
        )
    ),

    apply_best_schedule,
    print_schedule.
