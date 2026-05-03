from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any
from openai import OpenAI

app = FastAPI()


class ModelsRequest(BaseModel):
    api_key: str
    api_base: str


class ChatRequest(BaseModel):
    api_key: str
    api_base: str
    model: str
    messages: List[Dict[str, Any]]
    temperature: float = 0.7


@app.post("/api/models")
async def get_models(req: ModelsRequest):
    try:
        client = OpenAI(api_key=req.api_key, base_url=req.api_base)
        models = client.models.list()
        return {"models": [m.id for m in models.data]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/chat")
async def chat(req: ChatRequest):
    try:
        client = OpenAI(api_key=req.api_key, base_url=req.api_base)
        response = client.chat.completions.create(
            model=req.model,
            messages=req.messages,
            temperature=req.temperature,
        )
        message = response.choices[0].message
        content = message.content or ""
        reasoning_content = getattr(message, "reasoning_content", None)

        return {
            "content": content,
            "reasoning_content": reasoning_content
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Mount static files
app.mount("/", StaticFiles(directory="static", html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
