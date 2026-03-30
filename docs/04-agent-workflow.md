# Agent 工作流设计

## 当前 workflow

- `intent_detect`
- `retrieve_context`
- `tool_or_answer`
- `response_grounding_check`
- `final_response`

## 当前意图类型

- `chitchat`
- `knowledge_qa`
- `task`

## 工具设计

当前 MVP 包含三个工具接口：

- `knowledge_search`
- `web_search_mock`
- `ticket_summary`
