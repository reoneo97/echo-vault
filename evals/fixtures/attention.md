---
title: Attention
tags:
  - attention
  - paper
  - nlp
---
Notes from the "Attention is all you need" paper. This is usually used for [[NLP]] tasks but have been successfully employed to [[Computer Vision]] tasks as well. Currently any model that uses attention mechanism is known as a transformer. 


## Attention Intuition
- For each token, we want to compute attention scores which is essentially a weighting function to decide how much to prioritize each individual token
- Idea is to make the computation parallelizable
	- Compared to RNN which will have exploding/vanishing gradient problems and is bottle necked by producing token one at a time
	- Forward pass for attention is completely parallelizable 
	- Unlimited range for one token to impact another token since there is no rollout of gradients 
## Attention Mechanism

![[Pasted image 20251130100453.png]]
Query: Vector use to search what we want
Key: Vector to represent the information
Value: Vector value of that particular representation

- Each of the $W^Q$, $W^K$ and $W^V$ vectors that we use to perform the projection are all unique and separate, we want to learn a different projection matrix 
- NOTE: For decoding, masking matrix must be used 
![[Pasted image 20251130100659.png]]
- The scores are obtained from the first part which will then be scaled by the value matrix $V^Q$ 
	- This matrix is a smaller dimension that the embedding dimension and thus an additional FC layer will be used to project it back 
- Since each encoder module uses residual embeddings, we update the representation based on the encoder embeddings obtained

Mapping between query and key,value pairs. 
- Output is a weighted sum of the values - Weight is a compatibility function which here is seen as some sort of similarity scoring. We want to draw attention to important/relevant words that are present in the context. 
- Scaled Dot product attention used
  - Dot product is a very easy way of evaluating the similarity of something
  - Dot product relatively simple to compute and is space efficient as it will be a scalar value.
- Scaled dot product is used by dividing by $d_k$ which is dimension of the keys - This is to stabilize everything else increasing the number of keys will cause severe overfitting. It will also cause the gradient vectors to stabilize better. 
- Sometimes for certain types of training, a mask can be used, this is used when we don't want the model to cheat by restricting the information that the model is able to access 

## Multi-head attention
Having more attention mechanisms since there are very many possible interactions between the different features and this will ideally help the model to learn better by drawing attention to more items. 
- Perform the attention mechanism several times and then concatenating all the output.
- This will then be multiplied by a linear layer which functions to compress the vector space back to the original space 
- Undergo a final linear layer to get the tensor back to the same dimension as the input 
## Self Attention
- Drawing attention of the input with itself
  - For each token in the input check the attention with all other tokens and weight that accordingly



## Parameters 

For the Queries, Keys and Values, we can think of it as $d \times d_2$ matrix where $d$ is the original embedding dimension and $d_2$ is the dimension of the, queries, keys and values. Usually $d_2 = \frac{d}{h}$ where $h$ is the number of attention heads. 
## Attention Calculation 
1. Compute the dot product of the query with all the keys
2. Perform the scaling operation by dividing by $\sqrt{d_k}$ 
3. Apply a softmax on all the values such that it will sum up to 1. This corresponds to the weights
4. Multiply the values by the weights to get weighted-values


# Encoder
There are several layers of encoder stacks and the encoders are used as a feature extraction process. 
- Multi-head attention mechanism
- Uses FCN - Only consists of linear layer
- Sublayer - Layer which performs the attention mechanism
- - There are two paths thru a sublayer, one goes through both. But the other output is a residual connection which bypasses the sublayer. This means that the dimension of each layer has to stay constant throughout

The transformer encoder is a set of MultiheadAttention together with several feed-forward layers that learn some of the patterns in the data. At the same time there are [[LayerNorm]], residual connections and dropout layers to control the training process and prevent overfitting. 
EncoderLayer from PyTorch based on this `nn.TransformerEncoderLayer(dim = 512,nhead = 4)`
```python
TransformerEncoderLayer(
  (self_attn): MultiheadAttention(
    (out_proj): _LinearWithBias(in_features=512, out_features=512, bias=True)
  ) 
  (linear1): Linear(in_features=512, out_features=2048, bias=True)
  (dropout): Dropout(p=0.1, inplace=False)
  (linear2): Linear(in_features=2048, out_features=512, bias=True)
  (norm1): LayerNorm((512,), eps=1e-05, elementwise_affine=True)
  (norm2): LayerNorm((512,), eps=1e-05, elementwise_affine=True)
  (dropout1): Dropout(p=0.1, inplace=False)
  (dropout2): Dropout(p=0.1, inplace=False)
)
```

In the multi-head attention layer, it finds the most efficient set of relative weights to perform the computation. For each of the linear layers, it tries to perform additional feature extraction by using linear layers. However the residual connection still remains which allows for information from the attention mechanism to persist well into the final encoder layer

### Shapes:

# Decoder
Decoder Architecture is slightly different because there is **both self attention** and **encoder-decoder attention**. Self attention is for the model to learn the connections between the current features that have been identified. **Encoder-Decoder Attention** is useful to draw attention to the original sentence since its important to reference it when doing the computation. This vector that it takes is the **K and V vectors of the encoded representation of the sentence**. The other part is **what words are in the output sentence**. This is the language model part, where the decoder learns how to predict the best word given the words that have already come out. For this one we will need masking to prevent attention to words in the future.

```python
TransformerDecoderLayer(
  (self_attn): MultiheadAttention(
    (out_proj): _LinearWithBias(in_features=512, out_features=512, bias=True)
  )
  (multihead_attn): MultiheadAttention(
    (out_proj): _LinearWithBias(in_features=512, out_features=512, bias=True)
  )
  (linear1): Linear(in_features=512, out_features=2048, bias=True)
  (dropout): Dropout(p=0.1, inplace=False)
  (linear2): Linear(in_features=2048, out_features=512, bias=True)
  (norm1): LayerNorm((512,), eps=1e-05, elementwise_affine=True)
  (norm2): LayerNorm((512,), eps=1e-05, elementwise_affine=True)
  (norm3): LayerNorm((512,), eps=1e-05, elementwise_affine=True)
  (dropout1): Dropout(p=0.1, inplace=False)
  (dropout2): Dropout(p=0.1, inplace=False)
  (dropout3): Dropout(p=0.1, inplace=False)
)
```
1) In “encoder-decoder attention” layers, the queries come from the previous decoder layer, and the memory keys and values come from the output of the encoder. This allows every position in the decoder to attend over all positions in the input sequence. This mimics the typical encoder-decoder attention mechanisms in sequence-to-sequence models such as (cite).

2) The encoder contains self-attention layers. In a self-attention layer all of the keys, values and queries come from the same place, in this case, the output of the previous layer in the encoder. Each position in the encoder can attend to all positions in the previous layer of the encoder.


## Positional Embeddings
- Attention mechanism will lose some information about the position of the different tokens, positional embeddings help to instruct the model to learn from the positions

