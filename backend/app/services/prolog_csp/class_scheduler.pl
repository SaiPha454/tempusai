:- dynamic scheduled/6.
:- dynamic best_result/3.
:- use_module(library(time)).

% Runtime input facts are loaded dynamically before solving.
% course/4, room/2, time_slot/1 and related predicates define the search domain.

:- dynamic course/4.
:- dynamic room/2.
:- dynamic time_slot/1.
:- dynamic slot_rank/2.
:- dynamic preferred_slot/2.
:- dynamic reserved_room/2.
:- dynamic reserved_prof/2.
:- dynamic constraint_professor_no_overlap/1.
:- dynamic constraint_student_groups_no_overlap/1.
:- dynamic constraint_room_capacity_check/1.

% ---------- Meta-interpreter ----------
% Execute goals through solve/1 so the scheduling flow is interpreted uniformly.
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

% Optimistic upper bound of soft score per course (used for pruning).
max_soft_per_course(2200).

% True when a course has at least one preferred slot declared.
has_preferred(Course) :- preferred_slot(Course, _).

% Room is free if it is not already scheduled and not externally reserved.
room_available(Room, Slot) :-
    \+ scheduled(_, _, _, Room, Slot, _),
    \+ reserved_room(Room, Slot).

professor_available(Prof, Slot) :-
    \+ scheduled(_, Prof, _, _, Slot, _),
    \+ reserved_prof(Prof, Slot).

year_available(Year, Slot) :-
    \+ scheduled(_, _, Year, _, Slot, _).

% Capacity check can be turned off via constraint_room_capacity_check(false).
capacity_ok(Course, Room) :-
    course(Course, _, _, RequiredCapacity),
    room(Room, Capacity),
    (constraint_room_capacity_check(true) -> Capacity >= RequiredCapacity ; true).

professor_constraint_ok(Prof, Slot) :-
    (constraint_professor_no_overlap(true) -> professor_available(Prof, Slot) ; true).

year_constraint_ok(Year, Slot) :-
    (constraint_student_groups_no_overlap(true) -> year_available(Year, Slot) ; true).

% ---------- Hard constraints (must always hold) ----------

hard_course_identity_ok(Course, Prof, Year) :-
    course(Course, Prof, Year, _).

hard_timeslot_exists_ok(Slot) :-
    time_slot(Slot).

hard_room_exists_ok(Room) :-
    room(Room, _).

hard_room_capacity_ok(Course, Room) :-
    capacity_ok(Course, Room).

hard_room_occupancy_ok(Room, Slot) :-
    room_available(Room, Slot).

hard_professor_overlap_ok(Prof, Slot) :-
    professor_constraint_ok(Prof, Slot).

hard_year_overlap_ok(Year, Slot) :-
    year_constraint_ok(Year, Slot).

hard_not_already_scheduled_ok(Course) :-
    \+ scheduled(Course, _, _, _, _, _).

% Master hard-feasibility predicate for a candidate assignment.
% A candidate that fails here is invalid and never explored.
hard_constraints_ok(Course, Prof, Year, Room, Slot) :-
    hard_course_identity_ok(Course, Prof, Year),
    hard_timeslot_exists_ok(Slot),
    hard_room_exists_ok(Room),
    hard_room_capacity_ok(Course, Room),
    hard_room_occupancy_ok(Room, Slot),
    hard_professor_overlap_ok(Prof, Slot),
    hard_year_overlap_ok(Year, Slot),
    hard_not_already_scheduled_ok(Course).

% In strict mode, courses with preferred slots must be placed in preferred slots.
strict_soft_ok(Course, Slot) :-
    (has_preferred(Course) -> preferred_slot(Course, Slot) ; true).

% Count how many classes of a specific year are already in this slot.
same_year_slot_load(Year, Slot, Load) :-
    findall(1, scheduled(_, _, Year, _, Slot, _), Marks),
    length(Marks, Load).

% Count total classes already placed in this slot across all years.
slot_load(Slot, Load) :-
    findall(1, scheduled(_, _, _, _, Slot, _), Marks),
    length(Marks, Load).

% Room-fit quality score favors utilization near the target band.
% This is a soft metric and does not replace hard capacity checks.
room_fit_score(Course, Room, Score) :-
    course(Course, _, _, Required),
    room(Room, Capacity),
    (
        Required =< 0
    ->
        Score = 0
    ;
        (
            Capacity >= Required
        ->
            Utilization is (Required * 100) // Capacity,
            GapToTarget is abs(85 - Utilization),
            (
                Utilization >= 70
            ->
                RawScore is 260 - (GapToTarget * 3)
            ;
                RawScore is -120 - ((70 - Utilization) * 4)
            ),
            (
                RawScore > 320
            ->
                Score = 320
            ;
                (
                    RawScore < -260
                ->
                    Score = -260
                ;
                    Score is RawScore
                )
            )
        ;
            Score = -300
        )
    ).

% ---------- Soft constraints (optimize quality, do not reject validity) ----------

% Strongly reward preferred slots.
soft_preferred_slot_score(Course, Slot, Score) :-
    (
        preferred_slot(Course, Slot)
    ->
        BaseScore = 2200
    ;
        (
            has_preferred(Course)
        ->
            % Negative base score discourages placing a course with preferences into a non-preferred slot.
            BaseScore = -2200
        ;
            BaseScore = 0
        )
    ),
    Score is BaseScore.

% Encourage spreading same-year classes across slots.
soft_year_spread_score(Year, Slot, Score) :-
    same_year_slot_load(Year, Slot, SameYearLoad),
    RawYearSpreadScore is 180 - (SameYearLoad * 130),
    (
        RawYearSpreadScore > 220
    ->
        Score = 220
    ;
        (
            RawYearSpreadScore < -260
        ->
            Score = -260
        ;
            Score is RawYearSpreadScore
        )
    ).

% Encourage global load balancing across all slots.
soft_slot_balance_score(Slot, Score) :-
    slot_load(Slot, SlotLoad),
    RawSlotBalanceScore is 120 - (SlotLoad * 24),
    (
        RawSlotBalanceScore > 160
    ->
        Score = 160
    ;
        (
            RawSlotBalanceScore < -180
        ->
            Score = -180
        ;
            Score is RawSlotBalanceScore
        )
    ).

% Favor earlier slots using precomputed slot_rank/2.
soft_slot_order_score(Slot, Score) :-
    (slot_rank(Slot, Rank) -> Score is 100 - Rank ; Score = 0).

% Combined soft objective used to rank feasible candidates.
% Only preferred-slot scoring is currently active by design.
soft_score(Course, Year, Room, Slot, Score) :-
    soft_preferred_slot_score(Course, Slot, PreferredScore),
    % Temporarily disabled soft constraints (can be re-enabled later):
    % room_fit_score(Course, Room, RoomFitScore),
    % soft_year_spread_score(Year, Slot, YearSpreadScore),
    % soft_slot_balance_score(Slot, SlotBalanceScore),
    % soft_slot_order_score(Slot, SlotOrderScore),
    % Score is PreferredScore + RoomFitScore + YearSpreadScore + SlotBalanceScore + SlotOrderScore.
    _ = Year,
    _ = Room,
    _ = Slot,
    Score is PreferredScore.

% Candidate generation modes:
% strict  -> hard constraints + strict preferred-slot compliance.
% relaxed -> hard constraints only; preferences influence score only.
candidate(mode(strict), Course, Prof, Year, Room, Slot, SoftScore) :-
    hard_constraints_ok(Course, Prof, Year, Room, Slot),
    strict_soft_ok(Course, Slot),
    soft_score(Course, Year, Room, Slot, SoftScore).

candidate(mode(relaxed), Course, Prof, Year, Room, Slot, SoftScore) :-
    hard_constraints_ok(Course, Prof, Year, Room, Slot),
    soft_score(Course, Year, Room, Slot, SoftScore).

% Build and order candidate domain for one course under current schedule state.
candidate_domain(Mode, Course, Domain) :-
    course(Course, Prof, Year, _),
    findall(
        cand(Prof, Year, Room, Slot, SoftScore),
        candidate(Mode, Course, Prof, Year, Room, Slot, SoftScore),
        RawDomain
    ),
    sort_candidates_best_first(RawDomain, Domain).

% Sort candidates from best to worst for deterministic search guidance.
sort_candidates_best_first(Domain, Sorted) :-
    findall(cand(P, Y, R, S, Score), member(cand(P, Y, R, S, Score), Domain), Raw),
    predsort(compare_candidate, Raw, Sorted).

% Candidate tie-break order:
% 1) higher soft score
% 2) lower current slot load
% 3) earlier slot rank
% 4) smaller room capacity
compare_candidate(Delta, cand(_, _, Room1, Slot1, Score1), cand(_, _, Room2, Slot2, Score2)) :-
    compare(ScoreOrd, Score2, Score1),
    (
        ScoreOrd \= (=)
    ->
        Delta = ScoreOrd
    ;
        (
            slot_load(Slot1, Load1),
            slot_load(Slot2, Load2),
            compare(LoadOrd, Load1, Load2),
            (
                LoadOrd \= (=)
            ->
                Delta = LoadOrd
            ;
                (
                    slot_rank(Slot1, Rank1),
                    slot_rank(Slot2, Rank2),
                    compare(RankOrd, Rank1, Rank2),
                    (
                        RankOrd \= (=)
                    ->
                        Delta = RankOrd
                    ;
                        (
                            room(Room1, Cap1),
                            room(Room2, Cap2),
                            compare(CapOrd, Cap1, Cap2),
                            Delta = CapOrd
                        )
                    )
                )
            )
        )
    ).

scheduled_load_for_year(Year, Load) :-
    findall(1, scheduled(_, _, Year, _, _, _), Marks),
    length(Marks, Load).

scheduled_load_for_prof(Prof, Load) :-
    findall(1, scheduled(_, Prof, _, _, _, _), Marks),
    length(Marks, Load).

sort_by_mcv(_, [], []).
% Most-constrained-course-first ordering (MCV-style heuristic).
% Includes tie-breaks using preference presence, domain size, and current load.
sort_by_mcv(Mode, Courses, SortedCourses) :-
    findall(
        PreferredRank-Count-YearLoad-ProfLoad-Course,
        (
            member(Course, Courses),
            course(Course, Prof, Year, _),
            candidate_domain(Mode, Course, Domain),
            length(Domain, Count),
            (
                Mode = mode(strict)
            ->
                (has_preferred(Course) -> PreferredRank = 0 ; PreferredRank = 1)
            ;
                PreferredRank = 0
            ),
            scheduled_load_for_year(Year, YearLoad),
            scheduled_load_for_prof(Prof, ProfLoad)
        ),
        CoursePairs
    ),
    keysort(CoursePairs, SortedPairs),
    pairs_values(SortedPairs, SortedCourses).

pairs_values([], []).
pairs_values([_-_-_-Value|Rest], [Value|Values]) :-
    pairs_values(Rest, Values).

% Quick forward-check: every remaining course must still have at least one candidate.
remaining_feasible(_, []).
remaining_feasible(Mode, [Course|Rest]) :-
    candidate_domain(Mode, Course, Domain),
    Domain \= [],
    remaining_feasible(Mode, Rest).

reset_best :- retractall(best_result(_, _, _)).

% Greedy warm-start to quickly produce an initial feasible/partial schedule.
% This baseline enables stronger pruning in later exact search phases.
greedy_seed(Mode, Courses) :-
    retractall(scheduled(_, _, _, _, _, _)),
    greedy_assign(Mode, Courses, 0, 0, Assigned, Soft, SeedSchedule),
    update_best_with_schedule(Assigned, Soft, SeedSchedule),
    retractall(scheduled(_, _, _, _, _, _)).

greedy_assign(_, [], Assigned, Soft, Assigned, Soft, SeedSchedule) :-
    snapshot_schedule(SeedSchedule).
% At each step, pick the next course by MCV and assign its best-ranked candidate.
greedy_assign(Mode, RemainingCourses, AssignedIn, SoftIn, AssignedOut, SoftOut, SeedSchedule) :-
    sort_by_mcv(Mode, RemainingCourses, [Course|Others]),
    candidate_domain(Mode, Course, Domain),
    (
        Domain = [cand(Prof, Year, Room, Slot, Score)|_]
    ->
        assertz(scheduled(Course, Prof, Year, Room, Slot, Score)),
        NextAssigned is AssignedIn + 1,
        NextSoft is SoftIn + Score,
        greedy_assign(Mode, Others, NextAssigned, NextSoft, AssignedOut, SoftOut, SeedSchedule),
        retract(scheduled(Course, Prof, Year, Room, Slot, Score))
    ;
        greedy_assign(Mode, Others, AssignedIn, SoftIn, AssignedOut, SoftOut, SeedSchedule)
    ).

% Snapshot current dynamic schedule into a plain list for storage in best_result/3.
snapshot_schedule(List) :-
    findall(
        scheduled(Course, Prof, Year, Room, Slot, Score),
        scheduled(Course, Prof, Year, Room, Slot, Score),
        List
    ).

% Better solution means:
% 1) more assigned courses
% 2) if tied, higher total soft score
better_than_best(Assigned, Soft, BestAssigned, BestSoft) :-
    Assigned > BestAssigned ;
    (Assigned =:= BestAssigned, Soft > BestSoft).

update_best(Assigned, Soft) :-
    snapshot_schedule(ScheduleList),
    update_best_with_schedule(Assigned, Soft, ScheduleList).

% Replace current best_result/3 only when the new result is strictly better.
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

% Materialize best_result schedule back into scheduled/6 facts.
apply_best_schedule :-
    retractall(scheduled(_, _, _, _, _, _)),
    (best_result(_, _, BestSchedule) ->
        forall(
            member(scheduled(Course, Prof, Year, Room, Slot, Score), BestSchedule),
            assertz(scheduled(Course, Prof, Year, Room, Slot, Score))
        )
    ;
        true
    ).

% Branch-and-bound pruning for full-assignment search.
% If optimistic soft upper bound cannot beat current best full solution, prune.
full_soft_prunable(Soft, RemainingCount, TargetCount) :-
    best_result(BestAssigned, BestSoft, _),
    BestAssigned =:= TargetCount,
    max_soft_per_course(MaxSoft),
    OptimisticSoft is Soft + (RemainingCount * MaxSoft),
    OptimisticSoft =< BestSoft.

search_full_best_soft(_, _, [], Assigned, Soft) :-
    update_best(Assigned, Soft).
% Explore only complete assignments (no skipping courses), maximizing soft score.
search_full_best_soft(Mode, TargetCount, Remaining, Assigned, Soft) :-
    length(Remaining, RemainingCount),
    (full_soft_prunable(Soft, RemainingCount, TargetCount) ->
        true
    ;
        sort_by_mcv(Mode, Remaining, [Course|Others]),
        candidate_domain(Mode, Course, Domain),
        Domain \= [],
        member(cand(Prof, Year, Room, Slot, Score), Domain),
        assertz(scheduled(Course, Prof, Year, Room, Slot, Score)),
        NextAssigned is Assigned + 1,
        NextSoft is Soft + Score,
        remaining_feasible(Mode, Others),
        search_full_best_soft(Mode, TargetCount, Others, NextAssigned, NextSoft),
        retract(scheduled(Course, Prof, Year, Room, Slot, Score)),
        fail
    ;
        true
    ).

% Pruning rule for partial search (where skipping courses is allowed).
partial_prunable(Assigned, Soft, RemainingCount) :-
    best_result(BestAssigned, BestSoft, _),
    MaxPossibleAssigned is Assigned + RemainingCount,
    max_soft_per_course(MaxSoft),
    OptimisticSoft is Soft + (RemainingCount * MaxSoft),
    (
        MaxPossibleAssigned < BestAssigned
    ;
        MaxPossibleAssigned =:= BestAssigned,
        OptimisticSoft =< BestSoft
    ).

search_partial_best(_, [], Assigned, Soft) :-
    update_best(Assigned, Soft).
% Partial fallback search: can skip unschedulable courses to maximize assignment count.
search_partial_best(Mode, Remaining, Assigned, Soft) :-
    length(Remaining, RemainingCount),
    (partial_prunable(Assigned, Soft, RemainingCount) ->
        true
    ;
        sort_by_mcv(Mode, Remaining, [Course|Others]),
        candidate_domain(Mode, Course, Domain),
        (
            member(cand(Prof, Year, Room, Slot, Score), Domain),
            assertz(scheduled(Course, Prof, Year, Room, Slot, Score)),
            NextAssigned is Assigned + 1,
            NextSoft is Soft + Score,
            search_partial_best(Mode, Others, NextAssigned, NextSoft),
            retract(scheduled(Course, Prof, Year, Room, Slot, Score)),
            fail
        ;
            search_partial_best(Mode, Others, Assigned, Soft)
        )
    ;
        true
    ).

% Time-bounded wrappers keep solver robust under strict execution limits.
try_full_with_timeout(Mode, Courses, TargetCount, Seconds) :-
    catch(
        call_with_time_limit(Seconds, search_full_best_soft(Mode, TargetCount, Courses, 0, 0)),
        _,
        true
    ).

try_partial_with_timeout(Mode, Courses, Seconds) :-
    catch(
        call_with_time_limit(Seconds, search_partial_best(Mode, Courses, 0, 0)),
        _,
        true
    ).

% Compute remaining wall-clock seconds from total budget.
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

phase_budget_with_reserve(StartTime, TotalSeconds, ReserveSeconds, PhaseBudget) :-
    remaining_seconds(StartTime, TotalSeconds, Remaining),
    BudgetFloat is Remaining - ReserveSeconds,
    (
        BudgetFloat =< 0
    ->
        PhaseBudget = 0
    ;
        PhaseBudget is ceiling(BudgetFloat)
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

% Emit final schedule as tab-separated facts: Course, Prof, Year, Room, Slot.
print_schedule :-
    forall(
        scheduled(Course, Prof, Year, Room, Slot, _),
        format('~q\t~q\t~q\t~q\t~q~n', [Course, Prof, Year, Room, Slot])
    ).

% Main orchestration pipeline:
% 1) reset state
% 2) greedy seed
% 3) strict full search
% 4) relaxed full search
% 5) relaxed partial search fallback
% 6) apply and print best schedule found
solve_and_print(TimeoutSeconds) :-
    solve((
        retractall(scheduled(_, _, _, _, _, _)),
        reset_best,
        findall(Course, course(Course, _, _, _), Courses),
        length(Courses, TargetCount),
        get_time(StartTime),

        % Seed quickly so timeout still returns useful partial assignments.
        greedy_seed(mode(relaxed), Courses),

        (
            bounded_phase_budget(StartTime, TimeoutSeconds, 25, StrictBudget),
            StrictBudget > 0
        ->
            try_full_with_timeout(mode(strict), Courses, TargetCount, StrictBudget)
        ;
            true
        ),

        (
            best_result(TargetCount, _, _)
        ->
            true
        ;
            (
                bounded_phase_budget(StartTime, TimeoutSeconds, 12, RelaxedBudget),
                RelaxedBudget > 0
            ->
                try_full_with_timeout(mode(relaxed), Courses, TargetCount, RelaxedBudget)
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
                bounded_phase_budget(StartTime, TimeoutSeconds, 8, PartialBudget),
                PartialBudget > 0
            ->
                try_partial_with_timeout(mode(relaxed), Courses, PartialBudget)
            ;
                true
            )
        ),

        apply_best_schedule,
        print_schedule
    )).

solve_and_print :-
    % Default total solver budget in seconds.
    solve_and_print(45).
