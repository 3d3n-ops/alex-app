import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const JUDGE0_HOST = process.env.RAPIDAPI_HOST
const JUDGE0_KEY = process.env.RAPIDAPI_KEY
const BASE_URL = `https://${JUDGE0_HOST}`;

// Type definitions
interface RunRequest {
  sourceCode: string;
  languageId: number;
  stdin?: string;
  base64?: boolean;
  additionalFiles?: Array<{ content: string; name: string }>;
}

interface RunResult {
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  message?: string;
  status?: { id: number; description: string };
}

// Utility for base64 encoding
const encodeBase64 = (str: string) => Buffer.from(str).toString("base64");
const decodeBase64 = (str?: string) => (str ? Buffer.from(str, "base64").toString("utf8") : "");

// Fetch available languages from Judge0
export async function getAvailableLanguages(): Promise<any[]> {
  if (!JUDGE0_HOST || !JUDGE0_KEY) {
    throw new Error("Judge0 API configuration missing. Please set RAPIDAPI_HOST and RAPIDAPI_KEY environment variables.");
  }

  try {
    const response = await axios.get(`${BASE_URL}/languages`, {
      headers: {
        "x-rapidapi-key": JUDGE0_KEY,
        "x-rapidapi-host": JUDGE0_HOST,
      },
    });
    return response.data || [];
  } catch (error: any) {
    console.error("Error fetching languages:", error);
    throw error;
  }
}

export async function runCode({
  sourceCode,
  languageId,
  stdin = "",
  base64 = true,
  additionalFiles = [],
}: RunRequest): Promise<RunResult> {
  // Validate environment variables
  if (!JUDGE0_HOST || !JUDGE0_KEY) {
    const errorMsg = "Judge0 API configuration missing. Please set RAPIDAPI_HOST and RAPIDAPI_KEY environment variables.";
    console.error(errorMsg);
    return { 
      stderr: errorMsg,
      message: "Configuration error: Missing API credentials"
    };
  }

  try {
    // Prepare submission payload
    const submissionPayload: any = {
      source_code: base64 ? encodeBase64(sourceCode) : sourceCode,
      language_id: languageId,
      stdin: base64 ? encodeBase64(stdin) : stdin,
    };

    // Add additional files for multi-file support
    if (additionalFiles && additionalFiles.length > 0) {
      submissionPayload.additional_files = additionalFiles.map(file => ({
        content: base64 ? encodeBase64(file.content) : file.content,
        name: file.name,
      }));
      console.log(`Submitting multi-file program with ${additionalFiles.length} additional files`);
    }

    // Step 1: Create a new submission
    const submission = await axios.post(
      `${BASE_URL}/submissions?base64_encoded=${base64}&wait=false`,
      submissionPayload,
      {
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-key": JUDGE0_KEY,
          "x-rapidapi-host": JUDGE0_HOST,
        },
      }
    );

    const token = submission.data.token;
    console.log("Submission token:", token);

    // Step 2: Poll for result
    let result: any = null;
    for (let i = 0; i < 20; i++) {
      const res = await axios.get(`${BASE_URL}/submissions/${token}?base64_encoded=${base64}`, {
        headers: {
          "x-rapidapi-key": JUDGE0_KEY,
          "x-rapidapi-host": JUDGE0_HOST,
        },
      });

      result = res.data;
      if (result.status?.id >= 3) break; // 1=In Queue, 2=Processing, >=3 means done
      await new Promise((resolve) => setTimeout(resolve, 700));
    }

    const output: RunResult = {
      stdout: decodeBase64(result.stdout),
      stderr: decodeBase64(result.stderr),
      compile_output: decodeBase64(result.compile_output),
      message: decodeBase64(result.message),
      status: result.status,
    };

    return output;
  } catch (error: any) {
    console.error("Error running code:", error);
    
    // Extract detailed error information
    let errorMessage = "Unknown error occurred";
    let errorDetails = "";

    if (error.response) {
      // API responded with error status
      const status = error.response.status;
      const statusText = error.response.statusText;
      const data = error.response.data;
      
      errorMessage = `Request failed with status code ${status}`;
      
      if (data) {
        if (typeof data === 'string') {
          errorDetails = data;
        } else if (data.error) {
          errorDetails = data.error;
        } else if (data.message) {
          errorDetails = data.message;
        } else {
          errorDetails = JSON.stringify(data);
        }
      } else {
        errorDetails = statusText || `HTTP ${status}`;
      }
      
      // Special handling for common errors
      if (status === 422) {
        errorMessage = "Validation error: Invalid request parameters";
        if (!errorDetails) {
          errorDetails = "Please check that language ID is valid and all required fields are provided.";
        }
      } else if (status === 401 || status === 403) {
        errorMessage = "Authentication error: Invalid API key or missing credentials";
      } else if (status === 429) {
        errorMessage = "Rate limit exceeded: Too many requests";
        errorDetails = "Please wait a moment before trying again.";
      }
    } else if (error.request) {
      // Request was made but no response received
      errorMessage = "No response from Judge0 API";
      errorDetails = "Please check your network connection and API endpoint configuration.";
    } else {
      // Error setting up the request
      errorMessage = error.message || "Error setting up request";
    }

    return { 
      stderr: `${errorMessage}${errorDetails ? `: ${errorDetails}` : ''}`,
      message: errorDetails || errorMessage
    };
  }
}

