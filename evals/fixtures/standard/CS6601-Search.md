---
title: Cs6601 Search
tags:
  - ai
  - search
  - course
  - gatech
---

- Search is an important set of algorithms to solve a particular problem

## Problem Definition
1. Initial State $S_0$
2. Actions $A(s)$ - For each state, there are several actions that the agent can take
3. Result $R(s,a)$ - Returns the new state after taking an action
4. Goal Test $G(s)$ - Returns boolean if the goal has been reached
5. Path Cost Function - $F(s, a, s_1, a_1, ...)$
	1. Usually will be used as a step cost function where each step is evaluated

#### Tree Search
- Tree search does not check backtracking because in a tree there will not be any repeated states
- Keeping track of explored states will remove this problem
#### Graph Search
- Keep a set of explored states which will remove the problem of duplicate paths

## BFS
- Find the minimum number of actions 
- Note: BFS only terminates when we are removing a path from the frontier
## DFS
- Frontier is always the smallest because it starts to close off paths
	- $O(n)$ for binary tree
- However this is at the expense of **completeness** (find a goal in an infinite tree)
	- For an infinite tree, the DFS will never start to backtrack and thus cannot find a goal within the infinite tree 
- BFS has $O(2^n)$ for binary tree
## Uniform Cost Search (UCS)
- Basically based on Djikstra's algorithm which searches in a greedy manner to always explore the cheapest cost first
- Note that the cost is based on the **cheapest total cost** not the additional step 
	- Have to consider the distance to the frontier node first
- There will also be a **relaxation step**, if we find a shorter path to some intermediate node, we take the min of that path

## Heuristic Based Search
- If we have some information/knowledge about the goal this will become an **informed search** which allows more efficient search
	- Example could be the straight line distance between the intermediate node and the goal

### Greedy Best First Search
- Only consider the heuristic $H$ and not the cost for each movement
- Combining UCS and Greedy Best First search gives us A*

## A* Search
- Greedy with respect to $f = g+ h$
	- $g$ is the path cost
	- $h$ is the heuristic/estimated distance
- Minimizing $g$ keeps the path short but using $h$ is used to inform the choices which are being explored
- Finding the optimal path is based on the heuristic
	- Must be optimistic $h(s) < true cost$
	- If this is true, h is said to be **admissible** which is the same thing as optimistic
	- If $h$ is larger than the true cost, it can change the path cost which causes the A* search to fail 

#### Consistency and Admissibility
- Admissibility : Never overestimates cost 
	- Search will be strictly decreasing
- Consistency:
	- $h(n) \leq c(n,a,n') + h(n')$
	- Basically admissible but for each step
	- Every consistent heuristic is admissible
	- Consistency means that A* is cost optimal
		- All paths will be optimal: No need to re-add state to frontier and never have to update the distance costs
## State Representation
- Search not only useful for geographical search, can also consider the different possible distinct states that the problem can be part of ![[Pasted image 20240821232105.png]]
- Sliding puzzle can also be modelled as a search space

## Sliding Puzzle 
H1: Number of misplaced blocks
H2: Sum of distance of blocks

- Both heuristics are admissible because they are optimistic and will not overestimate the cost
- However, H1 will always be smaller than H2 
	- A* using H2 will expand fewer paths 
- Heuristics can usually be defined based on **the problem definition**
- We can use the maximum of heuristics which will always be better
	- Multiple heuristics can result in fewer path expansions **BUT** can take some time to compute

## Limitations of Search
- Fully Observable
- Known
- Discrete
- Deterministic
- Static/Stationary

## Implementation
- Frontier - Priority Queue and Set/Hashtable
- Explored - Set
