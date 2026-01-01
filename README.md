# Voice to Text Desktop Application

A professional real-time speech-to-text desktop application built with Tauri, React, and Deepgram AI. This cross-platform application provides accurate voice transcription with support for multiple languages and a modern, responsive interface.

![App Preview](https://github.com/hhsksonu/voice-to-text/blob/main/speech-to-text-dark.png/?text=Voice+to+Text+App+Screenshot)

![App Preview](https://github.com/hhsksonu/voice-to-text/blob/main/speech-to-text-light.png?text=Voice+to+Text+App+Screenshot)

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Architecture](#architecture)
- [Known Limitations](#known-limitations)
- [Building for Production](#building-for-production)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Features

### Core Functionality
- **Real-time Speech Recognition** - Live transcription using Deepgram's Nova-2 model
- **Multi-language Support** - English, Hindi, and Spanish
- **Recording Timer** - Track how long you've been speaking
- **Edit Capability** - Edit transcriptions before finalizing
- **Live & Final Transcripts** - Separate views for active and completed transcriptions
- **Export Options** - Download transcripts as .txt files
- **Clipboard Support** - One-click copy to clipboard
- **Dark/Light Mode** - Eye-friendly interface with theme toggle

### Technical Features
- **Low Latency** - WebSocket-based real-time streaming
- **Secure** - Native desktop application with sandboxed environment
- **Responsive Design** - Adapts to different window sizes
- **Error Handling** - Comprehensive error messages and connection status
- **Auto-reconnection** - Handles connection interruptions gracefully

## Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **CSS3** - Custom styling with CSS variables for theming

### Backend
- **Rust** - Core application logic
- **Tauri 2.x** - Desktop application framework
- **Tokio** - Async runtime for Rust
- **tokio-tungstenite** - WebSocket client implementation

### APIs & Services
- **Deepgram API** - Speech-to-text AI service
- **WebSocket** - Real-time bidirectional communication

### Plugins
- **tauri-plugin-dialog** - Native file dialogs
- **tauri-plugin-fs** - File system operations

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Rust** (latest stable version)
- **Cargo** (comes with Rust)
- **Deepgram API Key** (get one at [deepgram.com](https://deepgram.com))

### System Requirements
- **Windows**: Windows 10 or higher
- **macOS**: macOS 10.15 or higher
- **Linux**: Modern distribution with GTK 3.0

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/voice-to-text-tauri.git
cd voice-to-text-tauri
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Rust dependencies (automatic when running Tauri)
cd src-tauri
cargo build
cd ..
```

### 3. Set Up Environment Variables

Create a `.env` file in the `src-tauri` directory:

```bash
# src-tauri/.env
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

**Important**: Never commit your `.env` file to version control. It's already included in `.gitignore`.

## Configuration

### Deepgram API Key

1. Sign up at [deepgram.com](https://deepgram.com)
2. Create a new project
3. Generate an API key
4. Add it to `src-tauri/.env`

### Customizing Languages

To add or modify languages, update:

**src/App.jsx:**
```javascript
const languages = ["English", "Hindi", "Spanish", "French"];
```

**src-tauri/src/main.rs:**
```rust
let lang_code = match params.language.as_str() {
    "English" => "en",
    "Hindi" => "hi",
    "Spanish" => "es",
    "French" => "fr",
    _ => "en",
};
```

## Usage

### Development Mode

```bash
npm run tauri dev
```

This will start the Vite dev server and launch the Tauri application in development mode with hot-reload enabled.

### Using the Application

1. **Select Language**: Choose your preferred language from the dropdown
2. **Hold to Speak**: Press and hold the "Hold to Speak" button
3. **Speak Clearly**: The live transcript will appear in real-time
4. **Release to Edit**: Release the button to enter edit mode
5. **Review & Edit**: Make any necessary corrections
6. **Click Done**: Move the text to Final Transcript
7. **Export**: Use Copy or Download buttons to save your transcript

### Keyboard Shortcuts

- **Mouse Down**: Start recording
- **Mouse Up**: Stop recording
- **Esc**: Cancel current operation (planned feature)

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   UI Layer   │  │  State Mgmt  │  │  Event Loop  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ Tauri IPC
┌────────────────────────┴────────────────────────────────┐
│                  Backend (Rust/Tauri)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Commands   │  │    State     │  │   Plugins    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ WebSocket
┌────────────────────────┴────────────────────────────────┐
│              Deepgram API (Cloud Service)                │
│           Real-time Speech Recognition Engine            │
└──────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

#### 1. **Tauri Over Electron**
- **Rationale**: Smaller bundle size (~3MB vs ~150MB), better performance, memory efficiency
- **Trade-off**: Less mature ecosystem compared to Electron

#### 2. **WebSocket Streaming**
- **Rationale**: Real-time bidirectional communication for live transcription
- **Implementation**: tokio-tungstenite for async WebSocket handling in Rust
- **Benefit**: Low latency (<200ms) for interactive user experience

#### 3. **Rust Backend for Audio Processing**
- **Rationale**: Performance-critical audio streaming requires efficient memory management
- **Benefit**: Zero-cost abstractions, memory safety without garbage collection

#### 4. **State Management Strategy**
- **Frontend**: React hooks (useState, useRef) for UI state
- **Backend**: Arc<Mutex<T>> for shared state across async tasks
- **Decision**: Keep state minimal and scoped to prevent race conditions

#### 5. **Separation of Live and Final Transcripts**
- **Rationale**: Users need to review/edit before committing text
- **UX Benefit**: Clear workflow with explicit user actions

#### 6. **Duplicate Detection Algorithm**
```rust
// Uses Set-based tracking + text-ending check
let previousFinalTexts = new Set();
if (!previousFinalTexts.has(trimmedText) && 
    !currentText.endsWith(trimmedText)) {
    // Add to transcript
}
```
**Why**: Deepgram can send duplicate final results; this prevents text repetition

## Component Breakdown

### Frontend Components

#### App.jsx
- **Purpose**: Main application component
- **Responsibilities**: 
  - State management
  - Event handling
  - UI rendering
- **Key States**:
  - `liveText`: Accumulated final transcription
  - `interimText`: Real-time interim results
  - `editableText`: User-editable text buffer
  - `finalText`: Committed transcripts

#### app.css
- **Purpose**: Styling and theming
- **Features**:
  - CSS variables for theme switching
  - Responsive design with clamp()
  - Media queries for various screen sizes

### Backend Components

#### main.rs
- **Commands**:
  - `start_deepgram`: Initialize WebSocket connection
  - `send_audio`: Stream audio chunks
  - `stop_deepgram`: Close connection
  - `check_connection`: Health check

- **State**:
  - `DeepgramState`: Manages WebSocket sender channel

- **Tasks**:
  - Audio sender task: Forwards audio to Deepgram
  - Transcript receiver task: Processes responses

## Known Limitations

### 1. **Language Support**
- **Current**: English, Hindi, Spanish
- **Limitation**: Kannada and other Indic languages not fully supported by Deepgram Nova-2
- **Workaround**: Fallback to English for unsupported languages
- **Future**: Consider integrating additional speech recognition services

### 2. **Offline Functionality**
- **Limitation**: Requires active internet connection for Deepgram API
- **Impact**: Cannot transcribe without network
- **Future**: Consider implementing offline speech recognition with lower accuracy

### 3. **Audio Quality**
- **Best Results**: Clear audio with minimal background noise
- **Limitation**: Performance degrades with:
  - Heavy background noise
  - Multiple speakers
  - Strong accents
- **Recommendation**: Use in quiet environment with good microphone

### 4. **Browser Recording Limits**
- **Limitation**: MediaRecorder API may have codec limitations on some systems
- **Current**: Uses WebM with Opus codec
- **Impact**: Might not work on older systems

### 5. **WebSocket Connection Stability**
- **Issue**: Long sessions (>5 minutes) may experience connection drops
- **Mitigation**: Automatic reconnection on connection loss
- **Future**: Implement exponential backoff retry strategy

### 6. **Text Editing During Recording**
- **Limitation**: Cannot edit while recording is active
- **Design Choice**: Prevents user confusion with live updates
- **Workaround**: Stop recording to enter edit mode

### 7. **File Size Limits**
- **Limitation**: No practical limit on transcript length
- **Performance**: Very long transcripts (>100KB) may slow down UI
- **Recommendation**: Use "Done" button periodically to segment long sessions

### 8. **Platform-Specific Behaviors**

**Windows:**
- Native file dialogs work perfectly
- No known issues

**macOS:**
- May require microphone permissions in System Preferences
- First launch might trigger security prompt

**Linux:**
- Requires GTK 3.0 libraries
- File dialog appearance varies by desktop environment

### 9. **API Rate Limits**
- **Deepgram Free Tier**: Limited monthly minutes
- **Impact**: Heavy users may exceed free quota
- **Solution**: Monitor usage in Deepgram dashboard

### 10. **Security Considerations**
- **API Key Storage**: Currently stored in .env file
- **Limitation**: Not encrypted at rest
- **Production Recommendation**: Use secure key management system
- **Never**: Commit API keys to version control

## Building for Production

### Step 1: Clean Previous Builds

```bash
# Delete old build artifacts
Remove-Item -Recurse -Force .\src-tauri\target\debug -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\src-tauri\target\release -ErrorAction SilentlyContinue

# Clean cargo cache
cd src-tauri
cargo clean
cd ..
```

### Step 2: Set Environment Variable

**Windows (PowerShell):**
```powershell
$env:DEEPGRAM_API_KEY="your_actual_api_key"
```

**macOS/Linux:**
```bash
export DEEPGRAM_API_KEY="your_actual_api_key"
```

### Step 3: Build

```bash
npm run tauri build
```

### Build Output

**Executable Location:**
```
src-tauri/target/release/voice-to-text-tauri.exe  (Windows)
src-tauri/target/release/voice-to-text-tauri      (macOS/Linux)
```

**Installer Location:**
```
src-tauri/target/release/bundle/msi/              (Windows)
src-tauri/target/release/bundle/dmg/              (macOS)
src-tauri/target/release/bundle/deb/              (Linux)
```

### Distribution

The built executable is:
- **Portable**: No installation required
- **Self-contained**: All dependencies bundled
- **Size**: ~5-10MB (much smaller than Electron apps)

## Project Structure

```
voice-to-text-tauri/
├── src/                          # Frontend source
│   ├── App.jsx                   # Main React component
│   ├── app.css                   # Styles and themes
│   └── main.jsx                  # React entry point
├── src-tauri/                    # Backend source
│   ├── src/
│   │   └── main.rs               # Rust application logic
│   ├── Cargo.toml                # Rust dependencies
│   ├── tauri.conf.json           # Tauri configuration
│   └── .env                      # Environment variables (not committed)
├── public/                       # Static assets
├── node_modules/                 # Node dependencies
├── package.json                  # Node.js configuration
├── vite.config.js                # Vite configuration
├── .gitignore                    # Git ignore rules
└── README.md                     # This file
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow Rust naming conventions (snake_case)
- Use React hooks for state management
- Add comments for complex logic
- Test all features before submitting PR
- Update README if adding new features

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Deepgram** for providing excellent speech-to-text API
- **Tauri Team** for the amazing desktop framework
- **React Team** for the UI library
- **Rust Community** for incredible tooling and support

## Support

If you encounter any issues or have questions:

1. Check the [Known Limitations](#known-limitations) section
2. Search existing [GitHub Issues](https://github.com/yourusername/voice-to-text-tauri/issues)
3. Create a new issue with:
   - Operating system and version
   - Steps to reproduce
   - Expected vs actual behavior
   - Error messages/logs

## Roadmap

### Planned Features
- [ ] Keyboard shortcuts
- [ ] Export to PDF/DOCX formats
- [ ] Multiple simultaneous recordings
- [ ] Speech-to-text accuracy metrics
- [ ] Custom vocabulary/domain-specific training
- [ ] Undo/Redo functionality
- [ ] Auto-save drafts
- [ ] Cloud sync (optional)

### Under Consideration
- [ ] Mobile app version
- [ ] Browser extension
- [ ] Team collaboration features
- [ ] Integration with note-taking apps

---

## Built By

**Sonu Kumar using Tauri, React, and Deepgram**
*Last Updated: December 2025*

## Website & Contact

* [Portfolio Website](https://hhsksonu.vercel.app/)
* [LinkedIn](https://www.linkedin.com/in/hhsksonu)
* [GitHub](https://github.com/hhsksonu) 

