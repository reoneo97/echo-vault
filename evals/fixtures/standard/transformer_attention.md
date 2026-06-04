# Transformer Attention

## Scaled Dot-Product Attention

Given queries Q, keys K, and values V:

```
Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V
```

- **Q, K, V** are linear projections of the input
- **d_k** is the key dimension — dividing by sqrt(d_k) prevents the dot products from growing large and pushing softmax into regions of very small gradients
- The output is a weighted sum of values, where weights are determined by query-key similarity

## Multi-Head Attention

Rather than performing a single attention function, multi-head attention runs h parallel attention heads:

```
MultiHead(Q, K, V) = Concat(head_1, ..., head_h) * W_O
where head_i = Attention(Q * W_Q_i, K * W_K_i, V * W_V_i)
```

Each head can attend to different representation subspaces. A model with 8 heads and d_model=512 uses d_k = d_v = 64 per head.

## Self-Attention vs Cross-Attention

- **Self-attention**: Q, K, V all come from the same sequence. Used in encoder and decoder layers.
- **Cross-attention**: Q comes from the decoder, K and V come from the encoder output. This is how the decoder attends to the input sequence.

## Computational Complexity

- Self-attention is O(n^2 * d) with respect to sequence length n — quadratic in sequence length, which is the bottleneck for long sequences.
- This motivated architectures like Longformer (sparse attention) and linear attention variants.

## Positional Encoding

Attention is permutation-invariant — it has no notion of order. Positional encodings (sinusoidal or learned) are added to token embeddings to inject sequence position information.
