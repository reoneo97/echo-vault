---
title: Cs7643 M2L1 Cnn
tags:
  - deep-learning
  - course
  - gatech
---


## Introduction 
- Architecture for images is quite different
- Usually we will want to make output nodes connected for **small localized regions**
	- Convolution operations performed for a particular window size
	- Convolution operation is a transformation to another space which is a feature map
- ![[Pasted image 20240128140806.png]]
- Convolution layers combined with non-linearities/pooling layers to reduce data dimensionality
	- Max Pooling
- Over the depth of the network, there will be multiple CNN and pooling (downsampling) layers that will serve as a feature extractor
- Finally we have a fully connected layer to perform the actual classification task

## CNN Design
- FC Layers not efficient for image data as it will result in many connections some of which do not learn any meaningful information
	- Using a window results in a $(K_1 \times K_2 + 1)\times M where M is the number of convolutional kernels
	- Can utilize weight sharing 
		- Given the same kernel, regardless of which patch the kernel is applied on, the same weight  values are used for the computation
		- This results in only one variable being adjusted during backpropagation
	- Each Kernel is a feature extractor
		- Feature extractor should be applied at many different positions throughout
- Image features are usually spatially localized
	- Image features will be near each other
	- Ie. Edges, Color etc. 
- Image feature are also stationary
	- Features can be located anywhere within the image - Center, Top right etc.

### Convolution Definition
![[Pasted image 20240128151618.png]]
- Having a feature extractor striding across a signal is known as a convolution
- ![[Pasted image 20240128152155.png]]
- Traditional interpretation of Convolution is that the **Kernel is flipped across** the image when performing a convolution
	- This is from the minus sign
- Cross Correlation
	- ![[Pasted image 20240128152542.png]]
	- Cross Correlation is the same thing except that there is no flipping and it is a simple dot product
- However when performing the actual learning for the network, the feature map of the convolution vs feature map of **cross-correlation** is **the same**
	- Usually **cross-correlation is the actual operation taken** for the sake of simplicity
- Convolution is still a linear operation (because its a dot product of a small window)
	- $W^Tx + b$ where W is the size of the kernel
- Interestingly when forward pass is a cross-correlation, backward pass will be a convolution
	- Allows for quick backpropagation

## Input/Output Sizes
![[Pasted image 20240128153151.png]]
- Vanilla Convolution: $(H-k_1 + 1)\times (W- K_2 + 1)$
- Padding
	- To add zeros to the edge of the image to make the convolution have the same size
	- Geometrically,  H = H+2 and W = W+2
- Striding
	- How many pixels to move in X, Y for each window movement
	- Striding will result in dimensionality reduction but can potentially result in skipping of pixels
	- Eg. Stride of 3 for 5x5 Input - Next stride is invalids
#### Multichannels
- Images will have 3 channels
- Kernels will be $H \times W \times C$ where $C$ is usually 3 for RGB values
- Each kernel will combine the 3 Channels into 1
- With $k$ kernels, the resultant feature map is $H\times W\times k$
- The model is learning different kernels via backpropagation and there can be many possible kernels to be learnt 
	- Since weights are randomly initialized, each kernel will learn a different type of feature due to each having their own local minima to find
- Actual computation will be flattened vectors dot product with flattened kernels
	- Can be computed quickly using GPUs
	- ![[Pasted image 20240128160207.png]]
## Pooling Layers
- Layers that are used for dimensionality reduction/downsampling
![[Pasted image 20240128160247.png]]
- Max pooling
	- Will just take max within a window
	- There will be **no parameters**, it will just block out the gradients from flowing back 
- Average Pooling
	- Not very common because gradients will still be able to flow through
- Convolutions and pooling layers are translation invariant
	- As long as a feature stays within the same pooling window, the output feature map will not change much 
	- Even if it moves out, it will just be a **translation** of the activation to another location