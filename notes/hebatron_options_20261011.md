# HEBATRON options

Checked October 11, 2026. Research only. No application model settings changed and no inference requests tested.

The official instruction model is HebArabNlpProject/Hebatron. The repository lists Apache 2.0. It is a Hebrew and English adaptation of NVIDIA Nemotron 3 Nano, with 31.6 billion total parameters and approximately 3 billion active parameters per token.

The published BF16 weights occupy about 63.2 GB. Running the original model needs additional memory for the serving process and context. Active parameter count does not describe total memory needed.

Featherless lists hosted Hebatron at $0.20 input and $0.80 output per million tokens. Its serving listing says FP8, 32K context and Cold. Developer plans for application API use start at $50 in monthly credits. Unused credits carry forward. The $25 chat plan excludes application API traffic and benchmarking.

Assumption for a cost example: 1,000 input tokens and 500 output tokens per request. Derived token cost is $0.0006 per request, or $0.60 per 1,000 requests, before the subscription commitment and any additional generated tokens or retries.

The authors report Hebrew reasoning averages of 73.8 for Hebatron, 68.9 for DictaLM 3.0 Thinking and 76.3 for Gemma 3 27B IT. These benchmarks do not establish superiority over the app's GPT 5.4 mini, nor accuracy for niqqud, beginner examples or translations into Russian, Spanish and French. Test those tasks and structured JSON before replacing the app model.

Sources:

* https://huggingface.co/HebArabNlpProject/Hebatron
* https://huggingface.co/HebArabNlpProject/Hebatron/tree/main
* https://featherless.ai/models/HebArabNlpProject/Hebatron
* https://featherless.ai/pricing
* https://arxiv.org/html/2605.11255v1
