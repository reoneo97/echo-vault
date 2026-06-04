---
title: Cs6601 Bayesnets
tags:
  - ai
  - bayesian-networks
  - course
  - gatech
---


## Conditional Independence
![[Pasted image 20240921225005.png]]
- Given a parent, all children are conditionally independent
	- Allows us to remove the dependence on T1 in the conditional probability and calculate

- Conditional independence does not imply absolute independence and absolute indepedence does not imply conditional independence
	- two independent variables can be dependent conditioned on a shared child
![[Pasted image 20240921230953.png]]

## Explaining Away
- From the bayes network above, given that we see H, knowledge of S will provide us with knowledge of R even though they are independent
  ![[Pasted image 20240923133546.png]]
- This phenomenon is known as explaining away where information about one the causal factors will change the posterior of the other causal factor
	- This will allow better prediction of the first causal factor
## Bayesian Networks
- Allow for factorization of the probability distribution by forcing independences between variables 
	- Overall it will become more scalable to large problems
	- ![[Pasted image 20240923134135.png]]
	- For variable with K-inputs, it will require $2^K$ variables
## D-Separation
> Reachability
- Any 2 variables are independent when conditioned on the parent 
	- Conditional independence is present given the parent
- Any 2 variables which are independent can be come dependent if conditioned on a shared child
	- Become dependent due to the explain-away effect
- Concept of Reachability
  ![[Pasted image 20240923135117.png]]
	- Look at the links between two variables, if there is a path they will be dependent
	- Knowing any variable along the path will cause them to become conditionally independent
	- Opposite for **descendants**
		- Descendants being known allows for their parents to be linked
		- Essentially creating an additional dependency link through the known variable

# Probabilistic Inference 
- Terminology
	- Evidence - Known variables - Variables which are sampled
	- Query - Variables that we want to find information about
	- Hidden - Variables which are neither but also need to be computed
- Output of inference will always be a posterior distribution
	- $P(Q_1, Q_2 | E_1 = e_1, E_2 = e_2)$
	- Possible to get the argmax which will be the MAP $\arg\max_q P(Q_1=q_1, Q_2=q_2 | E_1 = e_1, E_2 = e_2)$

## Enumeration
- Iterates over all possibilities and adds them up
- ![[Pasted image 20240923144710.png]]
	- $f$ is a function corresponding to the summation of all terms for a particular value of e and a 
## Optimizing Enumeration
- Enumeration stops being scalable when the number of hidden variables become extremely large or have multiple possible values
- One method will be to simplify the calculation by **rearranging terms**
	- Enumeration is performed over hidden variables but some probabilities are **independent of the hidden variables**
	- Allow fewer computations by rearranging

## Maximize Independence
- More independences lead to fewer computations
- Bayes nets should be written in the causal direction
	- Try to decide which items are causes and which are effects to simplify the independences

## Variable Elimination
1. Joining Factors - Combine probability matrices which are commonly used together
	- Essentially combine $P(R)P(T|R)$ into $P(T,R)$ which is more compact
2. Marginalization
	- From the joint probability $P(R, T)$ form $P(T)$ which only has one item
- Important to decide when to perform variable elimination based on the structure of the graph
	- If there is a particular area with many hidden variables together, elimination could be useful
## Approximate Inference (Sampling)
- Sampling to estimate the joint probability distribution. Essentially makes the computation more simple as it relies of simulating the process instead of computation
- Sampling is consistent - Will approximate the true value as the number of samples approach infinity
- **Conditional Distribution (Rejection sampling)**
	- Basically perform sampling but reject all samples which are not in the condition
	  - Problem is that this can be inefficient if the condition is rare - End up rejecting a lot of samples which do not help in calculation of the joint
  - **Likelihood Weighting**
	  - Fixing a particular variable to a number
		  - This causes inconsistency as the samples drawn are not true
	  - For all fixed variables, the weight of the sample is the likelihood
		  - Will end up being consistent
  - **Gibbs Sampling (MCMC)**
	  - Resample one variable at a time, conditioned on the other variables
	  - For each iteration fix all other variables and compute one (this might cause the value to flip)
	  - Store that sample
	  - Only keep the last few samples to compute the joint
