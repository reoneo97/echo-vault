---
title: Cme295 Llm Tuning
tags:
  - llm
  - fine-tuning
  - course
---

> Lecture from CME 295 which looks at how to tune LLM models towards human preferences. For most LLM applications, the correctness of the model is not the only important aspect 


## [[RLHF]]
- Learning from human-annotated preference pairs to imbue LLMs with some type of characteristic/identity to be more suited to a particular task
	- Usually these metrics are safety, truthfulness metrics which are important for building a chatbot which has to respond well to user queries


### Reward Model
- Given a list of preference pairs where one output is better than another, we can use the Bradley-Terry formulation
	- $$p(y_i \geq y_j) = \frac{e^{r_i}}{e^{r_i} + e^{r_j}} = \sigma(r_i - r_j)$$
	- Essentially we can use the sigmoid function to provide a score 
- Loss Function to train reward model
	- $$
	  \begin{align}
	  \max \prod \sigma(r_i - r_j) &= \max \prod \sigma\bigg(r(x, \hat{y_i}) - r(x, \hat{y_j})\bigg) \\
	  &= \max \sum\log \sigma\bigg(r(x, \hat{y_i}) - r(x, \hat{y_j})\bigg) \\
	  &= - \min \mathbb{E} \bigg[ \log \sigma\bigg(r(x, \hat{y_i}) - r(x, \hat{y_j})\bigg)\bigg]
	  \end{align}
	  $$
	- Reward model is trained using this loss function
	- Once a reward model $r(x, \hat{y_i})$ has been trained to score (query, response) pairs it can then be used in a pointwise manner to provide scores for a query response pair
- Model
	- Usually reward models are simple LLM with a classification head - Return score 
	- Alternatively encoder style models can also be used similar to BERT
- Data
	- Usually around 10k observations where label = human rating on a particular dimension (safety, helpfulness, politeness etc )

### RL Training
- Once reward model has been developed, it can then be frozen
- Reward model will be used to score responses from LLM which will then be tuned via an RL algorithm
	- Have to ensure that the model will need to be trained without deviating too far from the other model 

## [[Proximal Policy Optimization]]
- First iteration of RLHF used PPO as a way to train the model while prevent catastrophic forgetting from occurring 
- $$
  \mathcal{L(\theta)} = - \Bigg[r(x, \hat{y}) - \lambda \text{KL} \bigg(\pi_\theta (\hat{y}| x) \;|| \;  \pi_{ref}(\hat{y}| x)\bigg)\Bigg]
  $$
- KL Divergence is a measure of deviation between two probability distributions
- Note that for PPO, instead of maximizing rewards, the model is usually used to maximize advantage 
	- Advantage = Reward - Baseline
	- Usually we will get a reward but we want to maximize the outperformance and taking this value instead of the raw rewards is better for training stability 
	- Advantage can have much lower variance when comparing to the baseline since the baseline considers what has already been output
		- If we just take raw reward scores, one step might cause the expected reward to change drastically given what action has been taken but for the advantage function it will always have mean 0 
- Training is done w.r.t to the entire sentence, not a single timestep reward but over the entire episode which is all the tokens in the response 
## DPO 
- Training method which removes the need for a reward model to be trained 