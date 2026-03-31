:- dynamic scheduled/5.
:- use_module(library(time)).

:- dynamic course/4.
:- dynamic room/2.
:- dynamic time_slot/1.
:- dynamic preferred_slot/2.
:- dynamic reserved_room/2.
:- dynamic reserved_prof/2.
:- dynamic constraint_professor_no_overlap/1.
:- dynamic constraint_student_groups_no_overlap/1.
:- dynamic constraint_room_capacity_check/1.

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
    predicate_property(Goal, built_in),
    !,
    call(Goal).
solve(Goal) :-
    clause(Goal, Body),
    solve(Body).

room_available(Room, Slot) :-
    \+ scheduled(_, _, _, Room, Slot),
    \+ reserved_room(Room, Slot).

professor_available(Prof, Slot) :-
    \+ scheduled(_, Prof, _, _, Slot),
    \+ reserved_prof(Prof, Slot).

year_available(Year, Slot) :-
    \+ scheduled(_, _, Year, _, Slot).

capacity_ok(Course, Room) :-
    course(Course, _, _, RequiredCapacity),
    room(Room, Capacity),
    (constraint_room_capacity_check(true) -> Capacity >= RequiredCapacity ; true).

candidate(Course, Prof, Year, Room, Slot) :-
    course(Course, Prof, Year, _),
    time_slot(Slot),
    room(Room, _),
    meta_constraint_checks(Course, Prof, Year, Room, Slot).

meta_constraint_checks(Course, Prof, Year, Room, Slot) :-
    solve((
        capacity_ok(Course, Room),
        room_available(Room, Slot),
        professor_constraint_ok(Prof, Slot),
        year_constraint_ok(Year, Slot),
        \+ scheduled(Course, _, _, _, _)
    )).

professor_constraint_ok(Prof, Slot) :-
    (constraint_professor_no_overlap(true) -> professor_available(Prof, Slot) ; true).

year_constraint_ok(Year, Slot) :-
    (constraint_student_groups_no_overlap(true) -> year_available(Year, Slot) ; true).

preferred_candidate(Course, Prof, Year, Room, Slot) :-
    candidate(Course, Prof, Year, Room, Slot),
    preferred_slot(Course, Slot).

fallback_candidate(Course, Prof, Year, Room, Slot) :-
    candidate(Course, Prof, Year, Room, Slot),
    \+ preferred_slot(Course, Slot).

schedule_course(Course, Prof, Year, Room, Slot) :-
    preferred_candidate(Course, Prof, Year, Room, Slot).

schedule_course(Course, Prof, Year, Room, Slot) :-
    fallback_candidate(Course, Prof, Year, Room, Slot).

count_available_slots(Course, Count) :-
    findall(
        1,
        candidate(Course, _, _, _, _),
        Slots
    ),
    length(Slots, Count).

pairs_values([], []).
pairs_values([_-Value|Rest], [Value|Values]) :-
    pairs_values(Rest, Values).

sort_by_constraints(Courses, SortedCourses) :-
    findall(
        Count-Course,
        (
            member(Course, Courses),
            count_available_slots(Course, Count)
        ),
        CountPairs
    ),
    keysort(CountPairs, SortedPairs),
    pairs_values(SortedPairs, SortedCourses).

check_remaining_feasible([]).
check_remaining_feasible([Course|Rest]) :-
    candidate(Course, _, _, _, _),
    check_remaining_feasible(Rest).

schedule_with_dynamic_mcv([]).
schedule_with_dynamic_mcv(RemainingCourses) :-
    sort_by_constraints(RemainingCourses, [MostConstrained|Others]),
    schedule_course(MostConstrained, Prof, Year, Room, Slot),
    assertz(scheduled(MostConstrained, Prof, Year, Room, Slot)),
    (
        check_remaining_feasible(Others),
        schedule_with_dynamic_mcv(Others)
    ->
        true
    ;
        retract(scheduled(MostConstrained, Prof, Year, Room, Slot)),
        fail
    ).

schedule_with_best_effort([]).
schedule_with_best_effort(RemainingCourses) :-
    sort_by_constraints(RemainingCourses, [MostConstrained|Others]),
    course(MostConstrained, _, Year, _),
    (
        once(schedule_course(MostConstrained, Prof, Year, Room, Slot))
    ->
        assertz(scheduled(MostConstrained, Prof, Year, Room, Slot))
    ;
        true
    ),
    schedule_with_best_effort(Others).

solve_all :-
    findall(Course, course(Course, _, _, _), Courses),
    schedule_with_dynamic_mcv(Courses).

solve_best_effort :-
    findall(Course, course(Course, _, _, _), Courses),
    schedule_with_best_effort(Courses).

try_solve_all_with_timeout(Seconds) :-
    catch(call_with_time_limit(Seconds, solve_all), _, fail).

try_solve_best_effort_with_timeout(Seconds) :-
    catch(call_with_time_limit(Seconds, solve_best_effort), _, true).

print_schedule :-
    forall(
        scheduled(Course, Prof, Year, Room, Slot),
        format('~q\t~q\t~q\t~q\t~q~n', [Course, Prof, Year, Room, Slot])
    ).

solve_and_print :-
    retractall(scheduled(_, _, _, _, _)),
    (try_solve_all_with_timeout(20) -> true ; try_solve_best_effort_with_timeout(6)),
    print_schedule.
