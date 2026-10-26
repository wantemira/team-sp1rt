from fastapi import Body, HTTPException, Query

from app.schemas.applications import ApplicationVersion


def requested_version(
    request: ApplicationVersion | None = Body(default=None),
    version: int | None = Query(default=None, ge=1, deprecated=True),
) -> int:
    """JSON — основной контракт; query сохранён на время перехода кабинетов."""
    if request is not None:
        if version is not None and version != request.version:
            raise HTTPException(status_code=422, detail='Переданы разные версии заявки. Обновите её и повторите действие.')
        return request.version
    if version is None:
        raise HTTPException(status_code=422, detail='Передайте актуальную версию заявки.')
    return version
