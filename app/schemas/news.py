from pydantic import BaseModel


class NewsItem(BaseModel):
    id: str
    title: str
    excerpt: str
    body: str
    relevance: str
