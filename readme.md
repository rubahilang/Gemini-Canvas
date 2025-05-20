# Gemini Canvas – Powerful AI Tools for Coding

Gemini Canvas is a web application built with Node.js and Express that leverages the Google Gemini API to generate and edit HTML, CSS, and JavaScript code dynamically based on user prompts. With a modern Tailwind CSS interface, users can save their prompt history, preview their code in real time, and download the result as a ZIP archive.

![Preview](videos/demo.gif)

## Features

- **Code Generation**  
  Generate complete HTML, CSS, and JS segments from a single prompt.  
- **Code Editing**  
  Edit a specific file type (HTML, CSS, or JS) by providing an “edit” prompt.  
- **File‑Type Detection**  
  Automatically detect which file to edit based on user instructions.  
- **User Authentication & History**  
  Secure signup/login with session cookies and bcrypt hashing.  
  Per‑user history stored in `data/history.json` and navigable via a sidebar drawer.  
- **Live Preview & Download**  
  Sandbox iframe for live preview of generated code.  
  Download all generated files as a ZIP.  
- **Dark/Light Theme**  
  Automatic theme switching based on user preference or system setting.  
- **Smooth UI Interactions**  
  Toast notifications, sliding history drawer, and responsive layout powered by Tailwind CSS.

## How It Works

1. **Prompt Submission**  
   The user enters a prompt in the sidebar and clicks “Generate” or “Apply Edit.”  
2. **API Request**  
   The server reads a template file (e.g. `prompt.txt` or `edit.txt`), injects the user’s prompt, and sends it to Google Gemini via the `@google/genai` client.  
3. **Response Parsing**  
   The raw response text is parsed with a regular expression to extract code segments for `html`, `css`, and `js`.  
4. **Image Placeholder Replacement**  
   Any `{imgN}` placeholders in the code are replaced by fetching random image URLs from an external API.  
5. **Temporary Storage**  
   Parsed code files are saved in `temp/<unique-id>/` and associated with the user’s session and history.  
6. **Displaying Results**  
   The frontend dynamically creates tabs for HTML, CSS, JS, and Preview, populates them, and renders the iframe.  
7. **Download**  
   When the user clicks “Download,” the server zips the files in `temp/<unique-id>/` and returns them as a ZIP download.

## Key Functions & Use Cases

- **Rapid Prototyping**  
  Quickly scaffold front‑end layouts and styles without writing boilerplate.  
- **Iterative Development**  
  Refine and tweak individual files by sending targeted edit prompts.  
- **Learning & Experimentation**  
  Explore AI‑driven code generation to learn best practices or experiment with design ideas.  

## Advantages

- **AI Automation**  
  Automates repetitive front‑end tasks and reduces manual coding.  
- **Modular Workflow**  
  Separates generate and edit flows; supports granular updates.  
- **User‑Friendly Interface**  
  Intuitive sidebar, live preview, and history navigation.  
- **Secure & Stateful**  
  Session‑based auth with encrypted passwords and per‑user histories.

## Limitations

- **API Dependency**  
  Requires reliable internet and valid Google Gemini API key.  
- **Cost**  
  Usage of Gemini API may incur charges based on request volume.  
- **Quality Variance**  
  Output quality depends heavily on prompt clarity.  
- **Storage Management**  
  Temporary directories can grow over time; requires cleanup strategy.

## Installation

1. Clone the repository.  
2. Install dependencies:  
   ```bash
   npm install express express-session bcrypt archiver node-fetch uuid @google/genai
   ```
3. Create `data/api.json` with your Gemini API key:  
   ```json
   {
     "apiKey": "ENTER_YOUR_GEMINI_API_KEY"
   }
   ```
4. Ensure directories `public/`, `data/`, and `temp/` exist (create if necessary).

## Usage

1. Start the server:  
   ```bash
   npm start
   ```
2. Open your browser at `http://localhost:3000`.  
3. Sign up or log in, enter a prompt, and explore generate/edit flows.  
4. View history via the sidebar drawer or download your code as ZIP.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests for:

- Bug fixes  
- Performance optimizations  
- New features or enhancements  

## Special Thanks

- [Gemini API](https://aistudio.google.com/app/apikey) — for providing powerful language understanding and generation.
- [waifu.im](https://www.waifu.im/) — for offering a beautiful collection of anime-style character images through their API.
