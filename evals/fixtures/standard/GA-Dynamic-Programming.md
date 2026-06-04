---
title: Ga Dynamic Programming
tags:
  - algorithms
  - dynamic-programming
  - course
  - gatech
---

> This module looks at how to express problems in terms of a dynamic programming approach which essentially tries to use the solutions from subproblems to solve the current problem

- DP in GA does not allow for memoization which essentially bars a lot of top down solutions which uses memoization to form the solution

## Longest Increasing Subsequence (LIS)

![[Pasted image 20250515111843.png]]
- The subproblem is the longest increasing subsequence that **includes** the last character i 
	- Last character is the only thing that determines whether the subsequence can be increased
- Algorithm
	- ![[Pasted image 20250517165638.png]]
![[Pasted image 20250515161951.png]]



## Bounded Knapsack
![[Pasted image 20250524213926.png]]
- Knapsack is actually not polynomial time because of the value B 
	- Integers are expressed in binary form and will take $\log B$ bits to express any integer
	- Because of this the input size is actually log B and not B 
	- Let input size $s = \log B$, this means that $O(nB) = O(n\cdot 2^S)$ which is not polynomial
![[Pasted image 20250515224654.png]]

## Unbounded Knapsack
- For the unbounded knapsack, since we are able to take as many copies of an item as possible, it is not necessary to have a 2D array and we can drop the dimension i to have a 1D array
- Time complexity will be the same but the space complexity will be reduced
- ![[Pasted image 20250524213833.png]]
- ![[Pasted image 20250515225334.png]]
### Obtaining the set
- Initialize an array S which will initially be filled with 0
	- Everytime we update the DP array K (found a better solution), we will fill S with the index of the item
	- Taking S(B) will return the index of the last item added. From there we can find the weight $w_i$ which will allow us to go the $S(B- w_i)$ to get the 2nd last item that was added. 
	- Backtracking will allow us to recreate the set of objects that was used to fill the knapsack

## Chain Matrix Multiply
![[Pasted image 20250515225725.png]]
![[Pasted image 20250515230315.png]]
- Essentially this problem becomes a substring optimization problem and the design pattern for optimizing a problem split based on a substring
### Filling up the table
- The base case for this problem is the diagonals, cost is 0 since for a single matrix there is no cost
- ![[Pasted image 20250515230536.png]]
- From the diagonal entries we move to the top which will use 2 entries from the diagonal
- Basically we start filling off diagonals bit by bit striding across the array in a diagonal manner to compute the final solution which is at the top right hand corner of the array, 
- ![[Pasted image 20250515231017.png]]


## DP - Graph Traversal
> This topic looks at how shortest path graph problems can be approached from a dynamic programming standpoint by breaking down a longer path into shortest path segments 

### Bellman Ford 
> Single source shortest path with possible negative weights

Use an array $D(i, z)$ to represent the shortest path from the source $s$ to target $z$ using at most $i$ edges
- Base Case:
	- $D(0,s)$ = 0 
		- We don't set $D(i, s)$ to be 0 since there can be a negative weight that may find separate shortest path to $s$
	- $D(0,z) = \infty  \ \ \forall z \neq s$
- Recursive Case
	- Shortest path requires $i$ edges
		- $D(i, z) = \min_y \{D(i-1, y) + w(y,z)\}$
	- Shortest path does not require $i$ edges
		- $D(i,z) = D(i-1, z)$
	- Taking the min of both recursive cases will definitely lead to an optimal solution
![[Pasted image 20250517135931.png]]
- Initialize to $D(i-1, z)$ first will be $\infty$ if there is no path
- Requires the flipped adjacency list (reverse graph) to look at all the nodes that go **into z**
	- $n^2$ time required to get the flipped list
- Negative Weight Cycle
	-  $i=n-1$ will be different from $i=n$
		- Run one more iteration of Bellman Ford and see if there are any changes in the distances in the graph
	- If there are no negative weight cycles, paths longer than the number of nodes in the graph should not decrease in distance
	- Once a negative weight cycle is detected, backtracking can be used to detect decreases in the graph to observe which elements are path of the negative weight cycle
- $O(nm)$
	- Nodes $\times$ Edges


## Floyd-Warshall
> All Pairs Shortest Path Algorithm which calculates the shortest path for all pairs $(y,z)$ that are present in the graph $\forall y,z \in v$


- $O(n^3)$ running time which is usually faster since $m$ can have a maximum value of $n(n-1)$ for a fully connected graph
## Idea
- Condition on # of edgs and  prefix of vertices that can be used to construct the shortest path
- As we slowly traverse the graph, we can slowly expand the graph to look at bigger paths such that each path will still be optimal
	- This means we also have to order and give each node an index from 0-n which will determine if they can be used
- DP Array is $D(i, s, t)$ 
	- i - Prefix of vertices useable
	- s - Source
	- t - Target
	- Note $D(s, t) \neq D(t, s)$ since the array is directed

Base Case:
- D(0, s, t) 
	- $w(s,t$) if there is an edge
		- $i$ represents intermediate nodes and not number of edges, thus it can still be connected if there are no intermediate edges
	- $\infty$ otherwise
Recurrence
- $i$ is not in the shortest path
	- $D(i,s,t) = D(i-1, s,t)$ 
		- Do not need $i$ to form the shortest path thus we can just set it to the previous value, either $\infty$ or the path found
- $i$ is on the shortest path
	- ![[Pasted image 20250517150426.png]]
	- $D(i, s, t) = D(i-1, s, i) + D(i-1, i, t)$
		- We definitely need to use $D(i-1)$ for the recurrence since its the only problem that has been solved thus far
	- For the subset it can be anything, empty set if its a direct path or a proper path
- Overall: $D(i,s,t) = \min \{ D(i-1, s,t,), D(i-1, s, i)  + D(i-1, i, t) \}$
- ![[Pasted image 20250517150837.png]]
	- The last slice where $i=n$ is the result of the algorithm and contains the lengths of all the shortest paths 
- Negative weight cycle
	- If there is a negative weight cycle present, the path of one of the nodes to  itself will be negative
	- paths to itself are the diagonal entries
	- any one diagonal being < 0 will indicate the presence of a negative weight cycle

Bellman Ford can only detect negative weight cycles that are reachable from source $s$, Floyd Warshall will detect all cycles in the graph


