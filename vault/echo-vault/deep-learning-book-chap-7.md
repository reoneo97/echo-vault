---
title: Deep Learning - Chapter 7
tags: 
---
# Deep Learning - Chapter 7: Regularisation

Regularisation is important for neural networks as neural nets have high capacity and thus have a high tendency to overfit especially on small datasets. This chapter highlights all the different general regularisation approaches. 

## Parameter Norm Penalties
- Simple way of applying regularisation is to penalize the weights of a neural network
  - $\tilde{J}(\theta, X, Y) = J(\theta, X, Y) + \alpha\Omega(\theta)$
  - This shows the general form of a norm penalty where the $\Omega$ function can be anything that penalizes the weights of the neural network
- Norm penalties prevent weights from becoming too large and represent 

### Weight Decay (L2 Penalization)
$$
\begin{align*}
\tilde{J}(\theta, X, Y) &= J(\theta, X, Y) + \frac{\alpha}{2}w^Tw \\
\nabla_w \tilde{J}(\theta, X, Y)&= \nabla_w J(\theta, X, Y) + \alpha w \\
w \leftarrow w - \epsilon\alpha w &+ \nabla_w J(\theta, X, Y) \\
w \leftarrow (1-\epsilon \alpha)w &- \epsilon\nabla_w J(\theta, X, Y)
\end{align*}
$$
- Simplest regularization method is to implement a L2 Loss on the weights
- As seen from the equation above, adding the L2 loss and optimizing the function using gradient descent is equivalent to adding a $(1-\epsilon\alpha)$ weight decay term. 
  - The weight will be reduced by a factor at every step
- Probabilistically, it can also be seen as **performing Bayesian updates** with a 0-mean prior on the gaussian

### L1 Regularization
- Another loss function is the L1 Loss
  - Gradient of the L1 loss is the sign operator
  - Gradient of this function is not linear w.r.t weights and weights will decay faster at low values 
  - Results in convergence towards a sparse value - Optimal value of 0
- Probabilistically - MAP on **isotropic Laplace prior**
## Weight Penalty as Constrained Optimization
- Weight decays and penalties can also be looked at as **constrained optimization problems**
- Performing a constrained optimization is equivalent to forming a KKT equation with Lagrange multipliers
  - $\alpha$ values for regularization will lead to the same equation as Lagrange multipliers for constrained optimization
  - Having L2 penalty is equivalent to performing constrained optimization where the problem is constrained to a n-dimensional ball at the origin
- Optimum solution will be located within the constraints that can be defined from the $\alpha$ values of the regularization function 
## Self Supervised Learning
- Semi-supervised learning where P(X) and P(x,y) is used to estimate P(y|x)
- Idea is to learn similar representations for prediction of both P(x) and P(y|x)
  - One simple way is to combine the log-likelihood functions $-\log P(x)$ and $-\log P(y|x)$ so that both objectives are incorporated
## Early Stopping
- Early stopping is similar to L2 or L1 but it will generally be easier to adjust
  - Can be proven that early stopping has the same effect
- Early stopping involves finding the correct time to stop by looking at both the training loss and validation loss
  - Stopping will then be done when there is no improvement to the validation loss while there is reduction of training loss
- Early stopping is easier to tune as it does not require having to find the optimum $\alpha$ value  
## Ensemble Methods + Dropout
- Ensemble methods like bagging and bootstrapping are commonly used to improve models by averaging multiple models
  - If models are uncorrelated they will improve the variance of the average prediction
  - If perfectly correlated they will not harm the model performance 
 ### Dropout
 - One simple way to create ensembles from neural networks is to train subnetworks at every time step and then average the prediction
 - Dropout can perform this by randomly setting some of the hidden layers to 0 at every time step 
   - This is usually done using a binary mask which will set the hidden output to 0 randomly
 - The training of this network can be seen as training a lot of subnetworks that correspond to the binary mask 
## Noise Robustness
- Noise can be added to the hidden units which represent a form of regularization
  - They push the weights to a point on a high-dimensional plane where it is insensitive to small changes in parameters

### Injecting Noise at Output Targets (Label Smoothing)
- This method is commonly used for incorrect datasets where the label $y$ may not be correct
  - Solution is to allow labels to be "incorrect" with probability $\epsilon$
    - Correct label becomes $1-\epsilon$
    - Incorrect label becomes $\frac{\epsilon}{k-1}$ where k represents the number of classes
- Essentially, this replaces the "hard target labels" with "softer" ones This method is called label smoothing 
## Dataset Augmentation
- Usually used for CV tasks
- Idea is to add additional noise or perform rotations, scaling to help the model learn invariances within the data 
## Sparse Representation



Is there some difference here now that I have written some stuff?