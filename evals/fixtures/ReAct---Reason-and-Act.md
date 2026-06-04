---
tags:
  - nlp/prompt
  - paper
---
> This paper provides a framework on teaching AI agents how to perform decision making together with reasoning. Idea is to **interleave reasoning and task-specific** traces [[AI Tools]] which improves ability of the model to accomplish a task. Reduce hallucination and error propagation


## Introduction
- Combine task-oriented actions with verbal reasoning
	- Important for self-regulation
	- Important for learning new tasks/skills
- Following this prompting strategy has been shown to work better compared to only Act or Reason ([[LLM-CoT]])
- Model was given a Wikipedia API when performing the tests
- Especially for tasks where some type of Reasoning is required to arrive at the desired result or when goals are a bit more abstract and will require some element of planning
- Outperforms CoT and Action Generation Models
	- Due to how attention works, **hallucinations can be generated easily if there is no grounding in facts**
	- Chain of thought relies mostly on internal representations to generate thoughts

## ReAct Mathematical Intuition
- Model Agent as a  [[RL-Book-C3-MDP]] or [[CS7642-POMDP]] where there are observations and actions to take 
	- Action: Tool Call
	- Language-Action: Reasoning Trace which does not affect external environment and does not create observations
		- Augments context $c_t$ and updates context to $c_{t+1} = (c_t, a_t)$


## Methodology
- One problem with the paper is that the explicit prompt is not really stated but its basically
	- You are an AI assistant that solves questions by interleaving reasoning (Thought), actions (Action), and observations (Observation). Use the following format:
		
		**Thought**: [your reasoning]  
		**Action**: [one action only, from: Search[...], Lookup[...], or Finish[...]]  
		**Observation**: [result from the action]
		
		Continue until you can confidently answer. End with **Finish[answer]**.
	- Here are some examples that you can use to solve questions...
		- Paste sample ReAct trajectories to guide the LLM 
- The reasoning traces are a combination of
	- Question decomposition: Reduce the question into more manageable chunks to better guide the model
		- “I need to get x, to find y and then z"
	- Extract information based on summaries
		- "From summary, x was started in 1844"
		- ”The paragraph does not tell x"
	- Arithmetic reasoning
		- "Since x is 1850 which is lesser than 1950, x occurred first"
- Action API - Tool based on Wikipedia Web API
	- Search - Returns 5 sentences from entity page
	- Lookup - Return next sentence that contains queried string
	- FInish - Finish current conversation
## Results
- Outperform vanilla CoT prompting (reasoning) and Acting only prompting on benchmarks like [[HotpotQA]] and [[FeVer]]
	- CoT-SC: Baseline created by using 21 sampling 21 CoT trajectories with Temp=0.7 and then taking majority answer
		- CoT trajectories are not grounded and thus can have high variance leading to a single sample being unreliable
- Allows for more interpretable reasoning traces 
- Best is utilizing ReAct + CoT
- Finetuning on ReAct traces leads to a lot better performance 
- Issues
	- ReAct can cause the model to repeat reasoning steps in a loop and not gain enough information to exit th eloop