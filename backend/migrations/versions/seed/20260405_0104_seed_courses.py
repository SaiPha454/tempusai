"""seed courses for resources module

Revision ID: 20260405_0104
Revises: 20260405_0103
Create Date: 2026-04-05 11:20:00
"""

from typing import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260405_0104"
down_revision: str | None = "20260405_0103"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        WITH course_seed(code, name, program_value) AS (
          VALUES
            ('SE1101', 'Introduction to Software Engineering', 'software-engineering'),
            ('SE1102', 'Programming Fundamentals', 'software-engineering'),
            ('SE1103', 'Discrete Mathematics', 'software-engineering'),
            ('SE1104', 'Calculus for Computing', 'software-engineering'),
            ('SE1105', 'Digital Logic Design', 'software-engineering'),
            ('SE1106', 'Communication for Engineers', 'software-engineering'),
            ('SE2101', 'Data Structures and Algorithms', 'software-engineering'),
            ('SE2102', 'Object-Oriented Programming', 'software-engineering'),
            ('SE2103', 'Database Systems', 'software-engineering'),
            ('SE2104', 'Software Requirements Engineering', 'software-engineering'),
            ('SE2105', 'Computer Networks', 'software-engineering'),
            ('SE3101', 'Software Architecture and Design', 'software-engineering'),
            ('SE3102', 'Web Application Engineering', 'software-engineering'),
            ('SE3103', 'Mobile Application Development', 'software-engineering'),
            ('SE3104', 'Software Testing and QA', 'software-engineering'),
            ('SE3105', 'DevOps and Continuous Delivery', 'software-engineering'),
            ('SE3106', 'Human-Computer Interaction', 'software-engineering'),
            ('SE4101', 'Cloud-Native Software Systems', 'software-engineering'),
            ('SE4102', 'Secure Software Engineering', 'software-engineering'),
            ('SE4103', 'AI for Software Engineers', 'software-engineering'),
            ('SE4104', 'Software Project Management', 'software-engineering'),
            ('SE4105', 'Software Engineering Capstone I', 'software-engineering'),
            ('CE1101', 'Engineering Mathematics I', 'computer-engineering'),
            ('CE1102', 'Physics for Engineers', 'computer-engineering'),
            ('CE1103', 'Programming for Computer Engineers', 'computer-engineering'),
            ('CE1104', 'Circuit Analysis Fundamentals', 'computer-engineering'),
            ('CE1105', 'Digital Systems', 'computer-engineering'),
            ('CE2101', 'Data Structures for Embedded Systems', 'computer-engineering'),
            ('CE2102', 'Electronics for Computer Engineering', 'computer-engineering'),
            ('CE2103', 'Computer Organization', 'computer-engineering'),
            ('CE2104', 'Signals and Systems', 'computer-engineering'),
            ('CE2105', 'Microcontroller Programming', 'computer-engineering'),
            ('CE2106', 'Probability and Statistics for Engineers', 'computer-engineering'),
            ('CE3101', 'Embedded Systems Design', 'computer-engineering'),
            ('CE3102', 'Operating Systems', 'computer-engineering'),
            ('CE3103', 'Computer Networks for CE', 'computer-engineering'),
            ('CE3104', 'Control Systems', 'computer-engineering'),
            ('CE3105', 'Instrumentation and Measurement', 'computer-engineering'),
            ('CE4101', 'Real-Time Systems', 'computer-engineering'),
            ('CE4102', 'VLSI Design Fundamentals', 'computer-engineering'),
            ('CE4103', 'IoT System Architecture', 'computer-engineering'),
            ('CE4104', 'Industrial Automation', 'computer-engineering'),
            ('CE4105', 'Computer Engineering Project Management', 'computer-engineering'),
            ('CE4106', 'Computer Engineering Capstone I', 'computer-engineering'),
            ('ME1101', 'Engineering Mathematics I', 'mechanical-engineering'),
            ('ME1102', 'General Physics for ME', 'mechanical-engineering'),
            ('ME1103', 'Engineering Drawing', 'mechanical-engineering'),
            ('ME1104', 'Statics', 'mechanical-engineering'),
            ('ME1105', 'Materials Science Fundamentals', 'mechanical-engineering'),
            ('ME1106', 'Computer-Aided Engineering Basics', 'mechanical-engineering'),
            ('ME2101', 'Dynamics', 'mechanical-engineering'),
            ('ME2102', 'Thermodynamics I', 'mechanical-engineering'),
            ('ME2103', 'Fluid Mechanics', 'mechanical-engineering'),
            ('ME2104', 'Manufacturing Processes', 'mechanical-engineering'),
            ('ME2105', 'Electrical Systems for ME', 'mechanical-engineering'),
            ('ME3101', 'Heat Transfer', 'mechanical-engineering'),
            ('ME3102', 'Machine Design I', 'mechanical-engineering'),
            ('ME3103', 'Control Engineering for ME', 'mechanical-engineering'),
            ('ME3104', 'Mechatronics', 'mechanical-engineering'),
            ('ME3105', 'Numerical Methods for Mechanical Systems', 'mechanical-engineering'),
            ('ME3106', 'Engineering Economics', 'mechanical-engineering'),
            ('ME4101', 'Renewable Energy Systems', 'mechanical-engineering'),
            ('ME4102', 'Advanced Manufacturing Systems', 'mechanical-engineering'),
            ('ME4103', 'Automotive Engineering Fundamentals', 'mechanical-engineering'),
            ('ME4104', 'Mechanical Project Management', 'mechanical-engineering'),
            ('ME4105', 'Mechanical Engineering Capstone I', 'mechanical-engineering'),
            ('CHE1101', 'Engineering Chemistry', 'chemical-engineering'),
            ('CHE1102', 'Calculus for Chemical Engineering', 'chemical-engineering'),
            ('CHE1103', 'Physics for Chemical Engineers', 'chemical-engineering'),
            ('CHE1104', 'Introduction to Chemical Engineering', 'chemical-engineering'),
            ('CHE1105', 'Material and Energy Balances', 'chemical-engineering'),
            ('CHE2101', 'Organic Chemistry for Engineers', 'chemical-engineering'),
            ('CHE2102', 'Thermodynamics for Chemical Processes', 'chemical-engineering'),
            ('CHE2103', 'Fluid Flow Operations', 'chemical-engineering'),
            ('CHE2104', 'Chemical Process Calculations', 'chemical-engineering'),
            ('CHE2105', 'Heat and Mass Transfer', 'chemical-engineering'),
            ('CHE2106', 'Chemical Engineering Laboratory I', 'chemical-engineering'),
            ('CHE3101', 'Chemical Reaction Engineering', 'chemical-engineering'),
            ('CHE3102', 'Separation Processes', 'chemical-engineering'),
            ('CHE3103', 'Process Instrumentation and Control', 'chemical-engineering'),
            ('CHE3104', 'Chemical Process Safety', 'chemical-engineering'),
            ('CHE3105', 'Process Simulation', 'chemical-engineering'),
            ('CHE4101', 'Biochemical Engineering', 'chemical-engineering'),
            ('CHE4102', 'Polymer Engineering', 'chemical-engineering'),
            ('CHE4103', 'Environmental Process Engineering', 'chemical-engineering'),
            ('CHE4104', 'Process Plant Design', 'chemical-engineering'),
            ('CHE4105', 'Chemical Engineering Project Management', 'chemical-engineering'),
            ('CHE4106', 'Chemical Engineering Capstone I', 'chemical-engineering')
        )
        INSERT INTO courses (id, code, name, program_id)
        SELECT gen_random_uuid(), cs.code, cs.name, p.id
        FROM course_seed cs
        JOIN programs p ON p.value = cs.program_value
        ON CONFLICT (code) DO UPDATE
          SET name = EXCLUDED.name,
              program_id = EXCLUDED.program_id;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM courses c
        USING programs p
        WHERE c.program_id = p.id
          AND p.value IN (
            'software-engineering',
            'computer-engineering',
            'mechanical-engineering',
            'chemical-engineering'
          )
          AND c.code ~ '^(SE|CE|ME|CHE)[1-4][0-9]{3}$';
        """
    )
