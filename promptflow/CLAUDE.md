# Project
This project is called Prom-Pilot, which is a tool for managing the prompts and having LLMops running on your code

## Project cababilities
```
I would like to create a tool for managing my prompts and flow of our LLM's.

That is a tool for having LLMOps. Similar to that of something like Langfuse. However I find that tool a bit lacking of features. In particular I want the below features to be possible:

- Have mulitple prompts and interactively design the flow that the final robot should use (input -> Prompt 1 -> output -> Prompt 2 -> Final output) 
- Have versioning on our prompt (Production, V1 etc.)
- Have evaluation (Both such that the user can run evaluation on changes to a prompt, but also evaluation in terms of LLM as a judge)
- See traces from actual usage of the various robots
- Have accesscontrol, so specific user can only access specific prompts or access a full flow
- Have et seperated by projects
- Be able to call the prompts and flow from python
- Be deployed as an Azure Web App (With storage account as its permanent storage)

And on top of that obviosuly have a nice and intuitive UI. I would like to use already available tools for as much of the functionality as possible. But since I have not been able to find a tool that does everything out of the box, lets try and plan to incoorporate those tool into a fully fnctioning app.

Ideally use python for the backend, and frontend is up for you to decide, as long as it is capable of grouping together and being deployed as an Azure Web App
```

## Tool usage
- To manage python package use `uv`
- Always have clear type annotations on methods. 
- Don't ever write in line comments (comments at the end of a line with code), only docstring 
- Seperate logic into multiple classes for easier compartmentalising
- Write clear test. But no need to over complicate it, rather write 1-2 test pr. class to test the full functionality of the class
- Use Opentelemtry for better logging
- Always ensure the code is well optimized
- Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
- Always use playwright mcp to evaluate the frotend work as intended

## Important notice
Always save important next steps in `PROGRESS.md` file