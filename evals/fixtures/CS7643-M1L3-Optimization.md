---
title: Cs7643 M1L3 Optimization
tags:
  - deep-learning
  - course
  - gatech
---

## M1L3: Deep Neural Network Optimization
- Depth is usually useful for neural networks
	- Parametrically efficient to invest in depth as most real world data that is being modelled has hierarchical features which can be better represented in deep neural networks
	- Usually hidden size will be gradually reduced down as we go deeper into the model
	- Deeper nodes will learn higher level representations and there will also be fewer high level representations
- Architecture should reflect the type of data
	- CNN for Images and RNN/Transformers for NLP
- Optimization of deep learning models is also important and should be chosen based on what model is being chosen
- Usually the heuristic is
	- Start with enough capacity - Sufficient depth and number of parameters
	- Use the capacity effectively by having a large dataset and using data augmentation and other methods 
	- Adding **appropriate biases** - Use the type of layers which are more useful for the type of data
- Importance of **Gradient Flow**
	- If gradients become smaller as they are being backpropagated, the learning will be reduced

## Non-Linearity Activation Functions
- Factors influencing non-linearity choice
	- Computational complexity
	- Gradient values near 0 and at extremes
	- Correspondence between input and output statistics
- There is NO right method to choose a non-linearity 

### **Sigmoid Function**
- Min 0 max 1
- Always positive output
- Saturated gradient at both ends of the function
	- This can be a problem as the gradient vanishes at very large values
	- Slow learning
	- Will cause upstream gradients to be even smaller
- Computationally complex

### Tanh Function
- Min -1, Max 1
	- Centered as it allows for both positive and negative values
- Gradients are saturated as well
- Quite computationally heavy

### ReLU Function
- Output is positive
- No saturation on positive end 
- Gradient is saturated on negative end
	- Can be problematic if all are negative
### Leaky ReLU
![[Pasted image 20240115205936.png]]


## Parameter Initialization
- Important to choose good initialization points where we can achieve good local minima
- Start with small values where the gradient values are larger 
- Bad initialization values
	- Constant value - All weight updates will move in the same direction which results in the same gradients
		- Shared Weights
- Usually we choose random normally distributed weights $\sim N(0, 0.01)$
- Deeper networks more sensitive to initialization
	- Deeper layers have weights which have much smaller standard deviation compared to earlier layers 
	- Ideally we want weights to be uniform **across the layers**
	- Xavier Initialization
		- ![[Pasted image 20240115210821.png]]
	- Balancing the incoming and outgoing gradients

## Data Preprocessing
- Normalization of data usually done
- Usually uncorrelating (whitening) is not done commonly and not very effective
- BatchNorm
	- Layer that is inserted throughout the model to ensure that the inputs to the layers are normalized
	- ![[Pasted image 20240115211645.png]]
	- All operations are differentiable and the gradients passing through is adjusted accordingly
	- BatchNorm will perform a different normalization for each batch **during training**
	- During **inference**, the stored mean/variances are used 
		- Sufficiently large batch size must be used for the mean/variance to be stable
		- Small batches may cause inaccurate estimations and thus numerical stability problems


## Optimizers
Neural networks are highly non-convex models and the optimization procedure is not trivial
- Noisy gradient estimates 
	- Gradient is calculated per minibatch and may not represent the actual gradient
	- Will have high variance
	- It is still unbiased but can have high variance 
- Saddle points
	- Local gradient of 0 for orthogonal directions
	- Very common in high-dimension vector spaces
- Ill-conditioned loss surface
	- Significantly more sensitive to other parameters 
	- Ineffective Learning
- Solutions for Noisy/Saddle
	- **Momentum:**
		- Updating the weights based on a velocity term which is updated by the gradient
		- Can be seen as an exponential moving average of previous gradients which allows for passing by regions with near 0 gradients quickly
		- ![[Pasted image 20240115212823.png]]
	- Nesterov Momentum
		- Similar to normal momentum except that velocity update is done **after the weight update**
		- ![[Pasted image 20240115213200.png]]
- Solution for Ill Conditioned Surface
	- Dynamic Learning Rates
		- To reduce the learning rate of regions with high curvature
		- Using gradient statistics to adjust learning rate across iterations
		- ADAGRAD
			- ![[Pasted image 20240204092209.png]]
			- Gradient Accumulator $G_i$ for the weight - Only squared to make in positive
			- For larger gradients to have reduced learning rate - Prevent big steps
		- RMSProp
			- ![[Pasted image 20240115215646.png]]
			- Same as AdaGrad except that the beta term will start to decay the gradient accumulator
		- For each weight, we look at the gradient and adjust the learning rate based on the gradient value
		- Note that the past gradient has to be discounted if not the gradient accumulation will keep on going and cause the learning rate to approach 0 
	- ADAM
		- ![[Pasted image 20240115215846.png]]
		- Basically combining the ideas of momentum and gradient adjusted learning rates
		- The $t$ parameter is to allow for numerical stability at the start when $v_i$ and $G_i$ values have just been initialized
- Learning Rate Scheduling
	- Grad Student Scheduling - Manual adjustment when plateau reached
	- Step Scheduler
	- Exponential Scheduler
	- Cosine Scheduler - Find many local minima and saving the model to find the best local minima in the training set

## Regularization
- Weight Decay
- Dropout Regularization
	- Only occurs during training and not during inference 
		- Since there is no dropout during inference, usually outputs are scaled so that the output during inference is similar to that of during training
	- Training the neural network to learn different features instead of always relying on the same ones
	- Similar to ensemble learning since for each dropout set we are training a different network
## Data Augmentation
- Usually for images to add some noise/transformations that the model should still be able to perform predictions
- Transformation
	- Translation
	- Rotation
	- Scale
	- Shear
- Random Crops
- Color Jitter

## Training Process
- Training neural networks is an art more than an exact science
- Important to document every process especially the loss and accuracy
- Learning Rate exploding: 
	- This indicates that learning rate might be too high
	- Might have some computation issues? Numerical Stability
	- `autograd.detect_anomaly()` - This can be used to trace when the NaN issue occurs
- Usually validation loss can be lower than training loss because there is no regularization term when calculating validation loss
	- Validation Loss is computed at the end of the epoch
- Hyperparameters **have to be tuned**
	- Good model architecture is insufficient to get good results if hyperparameter optimization is not conducted 
- Hyperopt Process
	- Coarse Search of various learning rates
		- Finer search near good values of learning rate 
	- Interdependence of Hyperparameters
		- Cannot be trained independently
		- Eg. Dropout and BatchNorm is usually bad together 
		- Learning Rate needs to be increased if batch size is increased
- Metrics
	- Precision/Recall not differentiable and usually we do not optimize for this value explicitly