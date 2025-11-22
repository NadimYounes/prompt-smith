# Prompt Smith - Chrome Extension

A professional AI prompt refinement extension that transforms basic inputs into engineering-grade prompts using 15 golden rules. Built with React, TypeScript, and the Google Gemini API.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn

## Setup & Installation

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Configure API Key**:
    Create a `.env` file in the root directory and add your Google Gemini API key. This is required for the refinement logic to work.
    ```env
    API_KEY=your_actual_api_key_here
    ```
    *Get a free API key at [aistudio.google.com](https://aistudio.google.com)*

## Building the Extension

Browsers cannot read TypeScript (`.tsx`, `.ts`) files directly. You must compile the project into standard JavaScript.

1.  Run the build command:
    ```bash
    npm run build
    ```
2.  This will create a `dist` (or `build`) folder in your project root. This folder contains the final extension files.

## Loading into Chrome

1.  Open Google Chrome and navigate to `chrome://extensions`.
2.  Enable **Developer mode** by toggling the switch in the top right corner.
3.  Click the **Load unpacked** button in the top left toolbar.
4.  Select the `dist` folder created during the build step.
5.  **Prompt Smith** should now appear in your toolbar!

## Troubleshooting

**"API Key is missing"**
Ensure you created the `.env` file before running the build command. The API key is embedded during the build process.

**"Could not inject"**
Refresh the web page (ChatGPT/Claude) after installing the extension for the content scripts to load properly.
