import { createExecutionConfig } from "./execution-runtime.mts";

// ESM is required for asynchronous fixture and benchmark loading.
export default await createExecutionConfig(process.env.SLOPSENTRAL_EXECUTION_FIXTURES);
