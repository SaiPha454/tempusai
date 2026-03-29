"""seed scheduling-ready academic data

Revision ID: 20260329_0003
Revises: 20260329_0002
Create Date: 2026-03-29 01:00:00
"""

from typing import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260329_0003"
down_revision: str | None = "20260329_0002"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO professors (id, name, is_any_time) VALUES
          (gen_random_uuid(), 'Prof. Anan Chaiyasit', true),
          (gen_random_uuid(), 'Prof. Narin Rattanakul', true),
          (gen_random_uuid(), 'Prof. Pimchanok Srisuk', true),
          (gen_random_uuid(), 'Prof. Kittipong Wattanapong', true),
          (gen_random_uuid(), 'Prof. Supatcha Limsakul', true),
          (gen_random_uuid(), 'Prof. Chonlathorn Boonmee', true),
          (gen_random_uuid(), 'Prof. Saran Kiatkarn', true),
          (gen_random_uuid(), 'Prof. Thanita Phromraksa', true),
          (gen_random_uuid(), 'Prof. Rachata Preechawong', true),
          (gen_random_uuid(), 'Prof. Napatsorn Wichian', true),
          (gen_random_uuid(), 'Prof. Ploy Sirikanya', true),
          (gen_random_uuid(), 'Prof. Arun Preechakul', true)
        ON CONFLICT (name) DO NOTHING;
        """
    )

    op.execute(
        """
        WITH course_seed(code, name, program_value) AS (
          VALUES
            ('CE1101', 'Calculus for Engineers', 'computer-engineering'),
            ('CE1102', 'Physics for Computer Engineering', 'computer-engineering'),
            ('CE1103', 'Engineering Drawing', 'computer-engineering'),
            ('CE1104', 'Programming Fundamentals', 'computer-engineering'),
            ('CE1105', 'Digital Systems Basics', 'computer-engineering'),
            ('CE1106', 'Introduction to Computer Engineering', 'computer-engineering'),
            ('CE2101', 'Digital Logic Design', 'computer-engineering'),
            ('CE2102', 'Data Structures for Embedded Systems', 'computer-engineering'),
            ('CE2103', 'Computer Organization', 'computer-engineering'),
            ('CE2104', 'Electronic Circuits', 'computer-engineering'),
            ('CE2105', 'Signals and Systems', 'computer-engineering'),
            ('CE2106', 'Discrete Mathematics for CE', 'computer-engineering'),
            ('CE3101', 'Microprocessor Systems', 'computer-engineering'),
            ('CE3102', 'Embedded Systems Design', 'computer-engineering'),
            ('CE3103', 'Computer Networks for CE', 'computer-engineering'),
            ('CE3104', 'Control Systems', 'computer-engineering'),
            ('CE3105', 'Operating Systems for Embedded Platforms', 'computer-engineering'),
            ('CE3106', 'Instrumentation and Measurement', 'computer-engineering'),
            ('CE4101', 'Real-Time Systems', 'computer-engineering'),
            ('CE4102', 'IoT Architecture and Applications', 'computer-engineering'),
            ('CE4103', 'VLSI Design Fundamentals', 'computer-engineering'),
            ('CE4104', 'Computer Engineering Project Management', 'computer-engineering'),
            ('CE4105', 'Industrial Automation', 'computer-engineering'),
            ('CE4106', 'Capstone Design Project I', 'computer-engineering'),
            ('SE1101', 'Introduction to Software Engineering', 'software-engineering'),
            ('SE1102', 'Programming Fundamentals', 'software-engineering'),
            ('SE1103', 'Discrete Mathematics', 'software-engineering'),
            ('SE1104', 'Database Concepts', 'software-engineering'),
            ('SE1105', 'Web Fundamentals', 'software-engineering'),
            ('SE1106', 'Software Development Workshop', 'software-engineering'),
            ('SE2201', 'Requirements Engineering', 'software-engineering'),
            ('SE2202', 'Software Design and Architecture', 'software-engineering'),
            ('SE2203', 'Software Testing', 'software-engineering'),
            ('SE2204', 'Object-Oriented Analysis and Design', 'software-engineering'),
            ('SE2205', 'Human-Computer Interaction', 'software-engineering'),
            ('SE2206', 'Software Configuration Management', 'software-engineering'),
            ('SE3101', 'Software Project Management', 'software-engineering'),
            ('SE3102', 'DevOps Engineering', 'software-engineering'),
            ('SE3103', 'Software Quality Assurance', 'software-engineering'),
            ('SE3104', 'Cloud-Native Application Development', 'software-engineering'),
            ('SE3105', 'Mobile Application Engineering', 'software-engineering'),
            ('SE3106', 'Secure Software Engineering', 'software-engineering'),
            ('SE4101', 'Enterprise Software Architecture', 'software-engineering'),
            ('SE4102', 'Agile Product Development', 'software-engineering'),
            ('SE4103', 'Software Process Improvement', 'software-engineering'),
            ('SE4104', 'AI-Assisted Software Development', 'software-engineering'),
            ('SE4105', 'Reliability Engineering', 'software-engineering'),
            ('SE4106', 'Capstone Software Project I', 'software-engineering')
        )
        INSERT INTO courses (id, code, name, program_id)
        SELECT gen_random_uuid(), c.code, c.name, p.id
        FROM course_seed c
        JOIN programs p ON p.value = c.program_value
        ON CONFLICT (code) DO UPDATE
          SET name = EXCLUDED.name,
              program_id = EXCLUDED.program_id;
        """
    )

    op.execute(
        """
        WITH student_seed(student_id, name, program_value, year) AS (
          VALUES
            ('CE660101', 'CE Student 1-01', 'computer-engineering', 1),
            ('CE660102', 'CE Student 1-02', 'computer-engineering', 1),
            ('CE660103', 'CE Student 1-03', 'computer-engineering', 1),
            ('CE660104', 'CE Student 1-04', 'computer-engineering', 1),
            ('CE660105', 'CE Student 1-05', 'computer-engineering', 1),
            ('CE660106', 'CE Student 1-06', 'computer-engineering', 1),
            ('CE660201', 'CE Student 2-01', 'computer-engineering', 2),
            ('CE660202', 'CE Student 2-02', 'computer-engineering', 2),
            ('CE660203', 'CE Student 2-03', 'computer-engineering', 2),
            ('CE660204', 'CE Student 2-04', 'computer-engineering', 2),
            ('CE660205', 'CE Student 2-05', 'computer-engineering', 2),
            ('CE660206', 'CE Student 2-06', 'computer-engineering', 2),
            ('CE660301', 'CE Student 3-01', 'computer-engineering', 3),
            ('CE660302', 'CE Student 3-02', 'computer-engineering', 3),
            ('CE660303', 'CE Student 3-03', 'computer-engineering', 3),
            ('CE660304', 'CE Student 3-04', 'computer-engineering', 3),
            ('CE660305', 'CE Student 3-05', 'computer-engineering', 3),
            ('CE660306', 'CE Student 3-06', 'computer-engineering', 3),
            ('CE660401', 'CE Student 4-01', 'computer-engineering', 4),
            ('CE660402', 'CE Student 4-02', 'computer-engineering', 4),
            ('CE660403', 'CE Student 4-03', 'computer-engineering', 4),
            ('CE660404', 'CE Student 4-04', 'computer-engineering', 4),
            ('CE660405', 'CE Student 4-05', 'computer-engineering', 4),
            ('CE660406', 'CE Student 4-06', 'computer-engineering', 4),
            ('SE760101', 'SE Student 1-01', 'software-engineering', 1),
            ('SE760102', 'SE Student 1-02', 'software-engineering', 1),
            ('SE760103', 'SE Student 1-03', 'software-engineering', 1),
            ('SE760104', 'SE Student 1-04', 'software-engineering', 1),
            ('SE760105', 'SE Student 1-05', 'software-engineering', 1),
            ('SE760106', 'SE Student 1-06', 'software-engineering', 1),
            ('SE760201', 'SE Student 2-01', 'software-engineering', 2),
            ('SE760202', 'SE Student 2-02', 'software-engineering', 2),
            ('SE760203', 'SE Student 2-03', 'software-engineering', 2),
            ('SE760204', 'SE Student 2-04', 'software-engineering', 2),
            ('SE760205', 'SE Student 2-05', 'software-engineering', 2),
            ('SE760206', 'SE Student 2-06', 'software-engineering', 2),
            ('SE760301', 'SE Student 3-01', 'software-engineering', 3),
            ('SE760302', 'SE Student 3-02', 'software-engineering', 3),
            ('SE760303', 'SE Student 3-03', 'software-engineering', 3),
            ('SE760304', 'SE Student 3-04', 'software-engineering', 3),
            ('SE760305', 'SE Student 3-05', 'software-engineering', 3),
            ('SE760306', 'SE Student 3-06', 'software-engineering', 3),
            ('SE760401', 'SE Student 4-01', 'software-engineering', 4),
            ('SE760402', 'SE Student 4-02', 'software-engineering', 4),
            ('SE760403', 'SE Student 4-03', 'software-engineering', 4),
            ('SE760404', 'SE Student 4-04', 'software-engineering', 4),
            ('SE760405', 'SE Student 4-05', 'software-engineering', 4),
            ('SE760406', 'SE Student 4-06', 'software-engineering', 4)
        )
        INSERT INTO students (id, student_id, name, program_id, year)
        SELECT gen_random_uuid(), s.student_id, s.name, p.id, s.year
        FROM student_seed s
        JOIN programs p ON p.value = s.program_value
        ON CONFLICT (student_id) DO UPDATE
          SET name = EXCLUDED.name,
              program_id = EXCLUDED.program_id,
              year = EXCLUDED.year;
        """
    )

    op.execute(
        """
        WITH plan_seed(program_value, year, course_code, professor_name) AS (
          VALUES
            ('computer-engineering', 1, 'CE1101', 'Prof. Anan Chaiyasit'),
            ('computer-engineering', 1, 'CE1102', 'Prof. Narin Rattanakul'),
            ('computer-engineering', 1, 'CE1103', 'Prof. Pimchanok Srisuk'),
            ('computer-engineering', 1, 'CE1104', 'Prof. Kittipong Wattanapong'),
            ('computer-engineering', 1, 'CE1105', 'Prof. Supatcha Limsakul'),
            ('computer-engineering', 1, 'CE1106', 'Prof. Chonlathorn Boonmee'),
            ('computer-engineering', 2, 'CE2101', 'Prof. Saran Kiatkarn'),
            ('computer-engineering', 2, 'CE2102', 'Prof. Thanita Phromraksa'),
            ('computer-engineering', 2, 'CE2103', 'Prof. Rachata Preechawong'),
            ('computer-engineering', 2, 'CE2104', 'Prof. Napatsorn Wichian'),
            ('computer-engineering', 2, 'CE2105', 'Prof. Ploy Sirikanya'),
            ('computer-engineering', 2, 'CE2106', 'Prof. Arun Preechakul'),
            ('computer-engineering', 3, 'CE3101', 'Prof. Anan Chaiyasit'),
            ('computer-engineering', 3, 'CE3102', 'Prof. Narin Rattanakul'),
            ('computer-engineering', 3, 'CE3103', 'Prof. Pimchanok Srisuk'),
            ('computer-engineering', 3, 'CE3104', 'Prof. Kittipong Wattanapong'),
            ('computer-engineering', 3, 'CE3105', 'Prof. Supatcha Limsakul'),
            ('computer-engineering', 3, 'CE3106', 'Prof. Chonlathorn Boonmee'),
            ('computer-engineering', 4, 'CE4101', 'Prof. Saran Kiatkarn'),
            ('computer-engineering', 4, 'CE4102', 'Prof. Thanita Phromraksa'),
            ('computer-engineering', 4, 'CE4103', 'Prof. Rachata Preechawong'),
            ('computer-engineering', 4, 'CE4104', 'Prof. Napatsorn Wichian'),
            ('computer-engineering', 4, 'CE4105', 'Prof. Ploy Sirikanya'),
            ('computer-engineering', 4, 'CE4106', 'Prof. Arun Preechakul'),
            ('software-engineering', 1, 'SE1101', 'Prof. Anan Chaiyasit'),
            ('software-engineering', 1, 'SE1102', 'Prof. Narin Rattanakul'),
            ('software-engineering', 1, 'SE1103', 'Prof. Pimchanok Srisuk'),
            ('software-engineering', 1, 'SE1104', 'Prof. Kittipong Wattanapong'),
            ('software-engineering', 1, 'SE1105', 'Prof. Supatcha Limsakul'),
            ('software-engineering', 1, 'SE1106', 'Prof. Chonlathorn Boonmee'),
            ('software-engineering', 2, 'SE2201', 'Prof. Saran Kiatkarn'),
            ('software-engineering', 2, 'SE2202', 'Prof. Thanita Phromraksa'),
            ('software-engineering', 2, 'SE2203', 'Prof. Rachata Preechawong'),
            ('software-engineering', 2, 'SE2204', 'Prof. Napatsorn Wichian'),
            ('software-engineering', 2, 'SE2205', 'Prof. Ploy Sirikanya'),
            ('software-engineering', 2, 'SE2206', 'Prof. Arun Preechakul'),
            ('software-engineering', 3, 'SE3101', 'Prof. Anan Chaiyasit'),
            ('software-engineering', 3, 'SE3102', 'Prof. Narin Rattanakul'),
            ('software-engineering', 3, 'SE3103', 'Prof. Pimchanok Srisuk'),
            ('software-engineering', 3, 'SE3104', 'Prof. Kittipong Wattanapong'),
            ('software-engineering', 3, 'SE3105', 'Prof. Supatcha Limsakul'),
            ('software-engineering', 3, 'SE3106', 'Prof. Chonlathorn Boonmee'),
            ('software-engineering', 4, 'SE4101', 'Prof. Saran Kiatkarn'),
            ('software-engineering', 4, 'SE4102', 'Prof. Thanita Phromraksa'),
            ('software-engineering', 4, 'SE4103', 'Prof. Rachata Preechawong'),
            ('software-engineering', 4, 'SE4104', 'Prof. Napatsorn Wichian'),
            ('software-engineering', 4, 'SE4105', 'Prof. Ploy Sirikanya'),
            ('software-engineering', 4, 'SE4106', 'Prof. Arun Preechakul')
        )
        INSERT INTO program_year_courses (id, program_id, year, course_id, professor_id)
        SELECT gen_random_uuid(), p.id, s.year, c.id, pr.id
        FROM plan_seed s
        JOIN programs p ON p.value = s.program_value
        JOIN courses c ON c.code = s.course_code
        LEFT JOIN professors pr ON pr.name = s.professor_name
        WHERE NOT EXISTS (
          SELECT 1
          FROM program_year_courses pyc
          WHERE pyc.program_id = p.id
            AND pyc.year = s.year
            AND pyc.course_id = c.id
        );
        """
    )

    op.execute(
        """
        WITH mappings(student_id, course_code) AS (
          VALUES
            ('CE660201', 'CE1102'),
            ('CE660201', 'CE1105'),
            ('CE660301', 'CE2103'),
            ('CE660401', 'CE3102'),
            ('SE760202', 'SE1103'),
            ('SE760302', 'SE2202'),
            ('SE760302', 'SE2203'),
            ('SE760402', 'SE3104')
        ),
        student_refs AS (
          SELECT DISTINCT s.id AS student_pk, m.student_id
          FROM mappings m
          JOIN students s ON s.student_id = m.student_id
        ),
        inserted_enrollments AS (
          INSERT INTO special_enrollments (id, student_id)
          SELECT gen_random_uuid(), sr.student_pk
          FROM student_refs sr
          WHERE NOT EXISTS (
            SELECT 1 FROM special_enrollments se WHERE se.student_id = sr.student_pk
          )
          RETURNING id, student_id
        ),
        chosen_enrollment AS (
          SELECT
            sr.student_id,
            sr.student_pk,
            COALESCE(
              (
                SELECT se.id
                FROM special_enrollments se
                WHERE se.student_id = sr.student_pk
                ORDER BY se.id
                LIMIT 1
              ),
              (
                SELECT ie.id
                FROM inserted_enrollments ie
                WHERE ie.student_id = sr.student_pk
                LIMIT 1
              )
            ) AS enrollment_id
          FROM student_refs sr
        )
        INSERT INTO special_enrollment_courses (enrollment_id, course_id)
        SELECT ce.enrollment_id, c.id
        FROM mappings m
        JOIN chosen_enrollment ce ON ce.student_id = m.student_id
        JOIN courses c ON c.code = m.course_code
        WHERE ce.enrollment_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM special_enrollment_courses sec
            WHERE sec.enrollment_id = ce.enrollment_id
              AND sec.course_id = c.id
          );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM special_enrollment_courses sec
        USING special_enrollments se, students s, courses c
        WHERE sec.enrollment_id = se.id
          AND se.student_id = s.id
          AND sec.course_id = c.id
          AND s.student_id IN ('CE660201','CE660301','CE660401','SE760202','SE760302','SE760402')
          AND c.code IN ('CE1102','CE1105','CE2103','CE3102','SE1103','SE2202','SE2203','SE3104');
        """
    )

    op.execute(
        """
        DELETE FROM special_enrollments se
        USING students s
        WHERE se.student_id = s.id
          AND s.student_id IN ('CE660201','CE660301','CE660401','SE760202','SE760302','SE760402')
          AND NOT EXISTS (
            SELECT 1 FROM special_enrollment_courses sec WHERE sec.enrollment_id = se.id
          );
        """
    )

    op.execute(
        """
        DELETE FROM program_year_courses pyc
        USING programs p, courses c
        WHERE pyc.program_id = p.id
          AND pyc.course_id = c.id
          AND p.value IN ('computer-engineering', 'software-engineering')
          AND c.code ~ '^(CE|SE)[0-9]{4}$';
        """
    )

    op.execute("DELETE FROM students WHERE student_id LIKE 'CE660%' OR student_id LIKE 'SE760%';")
