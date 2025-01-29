import { ChatOpenAI } from "@langchain/openai";

async function test() {
  const llm = new ChatOpenAI();
  const response = await llm.invoke("Hello, world!");
  console.log(response);
}

test(); 