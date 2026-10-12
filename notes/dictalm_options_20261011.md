# DictaLM options for HebrewTime

Checked: 2026 October 11. Research only. No application code or model setting changed.

The current app uses gpt-5.4-mini in src/app/actions.ts for AI translation, examples, and sentence completion. Example sentences and exercises request full Hebrew vowel marks and translations into the selected app language. The response must be valid JSON. Requests have a 20 second timeout.

The requested DictaLM model is initialized from Mistral Small 3.1 24B Base 2503. It received continued Hebrew and English training and chat and reasoning training. It is free to download under Apache 2.0. Free weights do not include hosted inference.

The official Hebrew evaluation reports 86.86 on its word diacritization metric for DictaLM 24B Thinking, compared with 60.21 for Gemma 3 27B. This is a task score, not overall correctness. The table does not compare it with gpt-5.4-mini and does not establish results for this app's exercises or Russian, Spanish, and French translations. A comparison using actual app prompts is needed before changing providers.

Local option: the official Q4_K_M GGUF file is 14.3 GB. Runtime memory is additional. A machine with 32 GB memory is a reasonable testing target, not a verified minimum. Existing suitable hardware avoids API fees but still has electricity and operating costs. A local model needs a separately available server to serve the deployed app.

Hosted option: Featherless lists the exact 24B Thinking model at $0.70 input, $0.04 cached input, and $1.16 output per million tokens. Its Developer plan starts at $50 per month in credits. Its $25 unlimited Chat plan excludes app traffic and benchmarking. Availability and response speed have not been tested.

Current GPT option: gpt-5.4-mini standard API pricing is $0.75 input and $4.50 output per million tokens. An illustrative request of 1,000 input and 500 output tokens costs $0.003, or $3 for 1,000 such requests, before retries or other charges. This is not observed application usage. Thinking output can change any cost comparison.

Hugging Face currently gives free accounts no included Inference Provider credits. The requested model card currently shows no Inference Provider deployment. Dicta's chat demo is a place to try the model; no documented free production API was established in this research.

Recommendation: keep GPT for the deployed app while comparing 50 to 100 representative prompts with DictaLM. Check natural Hebrew, vowel marks, all four translation languages, exact blank placement, valid JSON, response time, and total cost. Local generation of reusable content can be an inexpensive experiment. Consider the official 12B Instruct alternative for lower memory and direct answers, while measuring the quality tradeoff. Share reusable content by word, meaning, language, and learner level to reduce duplicate generation across users.

Sources:

1. https://huggingface.co/dicta-il/DictaLM-3.0-24B-Thinking
2. https://www.dicta.org.il/publications/DictaLM_3_0___Techincal_Report.pdf
3. https://huggingface.co/dicta-il/DictaLM-3.0-24B-Thinking-GGUF/tree/main
4. https://featherless.ai/models/dicta-il/DictaLM-3.0-24B-Thinking
5. https://featherless.ai/pricing
6. https://huggingface.co/docs/inference-providers/pricing
7. https://developers.openai.com/api/docs/models/gpt-5.4-mini
8. https://huggingface.co/dicta-il/DictaLM-3.0-Nemotron-12B-Instruct
