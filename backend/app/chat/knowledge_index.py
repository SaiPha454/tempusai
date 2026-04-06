import json
from dataclasses import dataclass

from llama_index.core import Settings, StorageContext, VectorStoreIndex
from llama_index.core.schema import TextNode
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
from llama_index.vector_stores.postgres import PGVectorStore
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.core.config import settings


@dataclass(frozen=True)
class KnowledgeChunk:
    key: str
    title: str
    text: str


BASE_KNOWLEDGE_CHUNKS: tuple[KnowledgeChunk, ...] = (
    KnowledgeChunk(
        key="domain-overview",
        title="Scheduling Domain Overview",
        text=(
            "This database stores university scheduling data: programs, courses, professors, students, "
            "program-year-course teaching assignments, timeslots, rooms, class schedule snapshots and entries, "
            "exam schedule snapshots and entries."
        ),
    ),
    KnowledgeChunk(
        key="class-scheduling-facts",
        title="Class Scheduling Facts",
        text=(
            "Class scheduling rows live in schedule_class_entries, linked to schedule_class_snapshots. "
            "Confirmed schedules use schedule_class_snapshots.status = confirmed. "
            "schedule_class_entries joins to courses, professors, timeslots, and rooms."
        ),
    ),
    KnowledgeChunk(
        key="teaching-assignment-facts",
        title="Teaching Assignment Facts",
        text=(
            "Program curriculum teaching assignment rows live in program_year_courses. "
            "Use joins with programs, courses, and professors to answer who teaches which course in each year/program."
        ),
    ),
    KnowledgeChunk(
        key="student-facts",
        title="Student Facts",
        text=(
            "Student counts by year and program come from students.year and students.program_id. "
            "Join students to programs for program grouping."
        ),
    ),
)


class SchedulingKnowledgeIndex:
    def __init__(self) -> None:
        self._index: VectorStoreIndex | None = None

    def _build_index(self) -> VectorStoreIndex:
        db_url = make_url(settings.database_url)

        Settings.llm = OpenAI(model=settings.openai_chat_model, api_key=settings.openai_api_key)
        Settings.embed_model = OpenAIEmbedding(
            model=settings.openai_embedding_model,
            api_key=settings.openai_api_key,
        )

        vector_store = PGVectorStore.from_params(
            database=db_url.database or "postgres",
            host=db_url.host or "localhost",
            password=db_url.password or "",
            port=int(db_url.port or 5432),
            user=db_url.username or "postgres",
            table_name=settings.chat_pgvector_table,
            embed_dim=settings.chat_embedding_dimension,
        )
        storage_context = StorageContext.from_defaults(vector_store=vector_store)
        index = VectorStoreIndex.from_vector_store(vector_store=vector_store, storage_context=storage_context)

        engine = create_engine(settings.database_url, future=True, pool_pre_ping=True)
        with engine.connect() as connection:
            count_query = text(f"SELECT COUNT(*) FROM {settings.chat_pgvector_table}")
            existing_count = int(connection.execute(count_query).scalar() or 0)

        if existing_count == 0:
            nodes = [
                TextNode(
                    id_=chunk.key,
                    text=chunk.text,
                    metadata={"title": chunk.title, "chunk_key": chunk.key},
                )
                for chunk in BASE_KNOWLEDGE_CHUNKS
            ]
            index.insert_nodes(nodes)

        return index

    def retrieve_context(self, question: str, top_k: int = 3) -> list[str]:
        try:
            if self._index is None:
                self._index = self._build_index()

            retriever = self._index.as_retriever(similarity_top_k=top_k)
            nodes = retriever.retrieve(question)
            return [
                json.dumps(
                    {
                        "title": node.metadata.get("title", ""),
                        "text": node.text,
                    }
                )
                for node in nodes
            ]
        except Exception:
            # Vector retrieval is optional for structured SQL-based QA.
            return []
