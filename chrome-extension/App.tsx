import React, { useState, useEffect, useCallback } from 'react'; // Bring in React and the hooks needed for state and lifecycle logic
import { MessageType, RefinementResponse, AppStatus, PersistedPopupState } from './types'; // Import shared TypeScript definitions used throughout the file
import { refineUserPrompt } from './services/geminiService'; // Import the function that sends the prompt to Gemini for refinement
import ScoreChart from './components/ScoreChart'; // Import the chart component that visualizes the score
import { FeatherLogo } from './components/Icons'; // Import the SVG logo component used in the header
import { Copy, Download, AlertCircle, Check, Sparkles } from 'lucide-react'; // Import icon components for buttons and feedback indicators
// ------------------------------------------------------------------------------------
const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.tabs; // Determine if the code is running inside the Chrome extension context
// ------------------------------------------------------------------------------------
const STORAGE_KEY = 'prompt-smith-v3-state'; // Key used to persist popup state inside chrome.storage
// ------------------------------------------------------------------------------------
const App: React.FC = () => { // Define the root React component for the popup UI
  const [originalPrompt, setOriginalPrompt] = useState(''); // Track the user’s current prompt text
  const [refinedData, setRefinedData] = useState<RefinementResponse | null>(null); // Hold the response returned by Gemini
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE); // Track whether the UI is idle, loading, success, or error
  const [errorMsg, setErrorMsg] = useState(''); // Store any human-readable error message
  const [copied, setCopied] = useState(false); // Track whether the refined prompt has just been copied
  const [syncingInput, setSyncingInput] = useState(false); // Track whether we are currently fetching text from the chat input
  const [hydrated, setHydrated] = useState(!isExtension); // Track whether persisted state has been reloaded (true immediately outside the extension)

  useEffect(() => { // On mount, load persisted state if running inside Chrome
    if (!isExtension) { // If we are outside the extension, skip storage and mark hydration complete
      setHydrated(true); // Flag that we can render immediately
      return; // Abort the storage lookup
    }

    chrome.storage.local.get([STORAGE_KEY], (result) => { // Read the stored state blob from chrome.storage.local
      const saved = result[STORAGE_KEY] as PersistedPopupState | undefined; // Extract and type the saved state if present
      if (saved) { // If we have stored data
        setOriginalPrompt(saved.originalPrompt || ''); // Restore the prompt text
        setRefinedData(saved.refinedData ?? null); // Restore the refined response if it existed
        setStatus(saved.status ?? AppStatus.IDLE); // Restore the last known status
        setErrorMsg(saved.errorMsg ?? ''); // Restore any error message
      }
      setHydrated(true); // Mark hydration as complete so UI can rely on the restored values
    });
  }, []); // Run this effect only once on mount

  useEffect(() => { // Whenever relevant pieces of state change, persist them for future popup sessions
    if (!isExtension || !hydrated) return; // Skip persistence if we are not in the extension or not yet hydrated
    const payload: PersistedPopupState = { // Build the object we want to store
      originalPrompt, // Include the current prompt text
      refinedData, // Include the refined response if available
      status, // Include the current status
      errorMsg // Include the current error string
    };
    chrome.storage.local.set({ [STORAGE_KEY]: payload }); // Save the payload under the shared key
  }, [originalPrompt, refinedData, status, errorMsg, hydrated]); // Re-run the effect whenever any of these dependencies change

  const fetchActivePrompt = useCallback( // Declare a memoized function for pulling text from the active chat input
    (force = false) => { // Accept a flag indicating whether we should force the fetch even if we already have text
      if (!isExtension) return; // Do nothing outside the extension environment
      setSyncingInput(true); // Show the loading spinner on the “Load from chat” button
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => { // Ask Chrome for the current active tab
        const tabId = tabs[0]?.id; // Read the tab ID from the first result
        if (!tabId) { // If we cannot resolve the tab
          setSyncingInput(false); // Stop the spinner
          if (force) setErrorMsg('Open the chat tab and focus the input first.'); // Notify the user when the fetch was forced
          return; // Abort because we cannot message any tab
        }
        chrome.tabs.sendMessage(tabId, { type: MessageType.GET_SELECTION }, (response: any) => { // Ask the content script to send back the active input contents
          setSyncingInput(false); // Stop the spinner after the message resolves
          if (chrome.runtime.lastError) { // If Chrome reports that the message failed
            if (force) setErrorMsg('Content script unavailable. Refresh the chat tab and try again.'); // Show guidance if the user explicitly requested the sync
            return; // Abort because we have no data
          }
          const payload = response?.payload || ''; // Read the text payload returned from the content script
          if (!payload) { // If the content script didn’t find any text
            if (force) setErrorMsg('No prompt detected. Click into the chat input and try again.'); // Advise the user if this was a forced sync
            return; // Nothing to update
          }
          setOriginalPrompt((current) => { // Update the prompt state, but only if needed
            if (current.trim() && !force) return current; // Keep the user’s edits unless the sync was forced
            return payload; // Otherwise adopt the text pulled from the chat input
          });
        });
      });
    },
    []
  ); // The callback never changes, so the dependency array is empty

  useEffect(() => { // After hydration, try to pull the active prompt once automatically
    if (!hydrated) return; // Wait for storage hydration before running
    fetchActivePrompt(); // Attempt to sync in the background without forcing
  }, [hydrated, fetchActivePrompt]); // Re-run if hydration or the callback reference changes

  const handleRefine = useCallback(async () => { // Declare the function that triggers the Gemini refinement call
    if (!originalPrompt.trim()) return; // Do nothing if the prompt box is empty
    
    setStatus(AppStatus.LOADING); // Show the loading spinner
    setErrorMsg(''); // Clear any previous error message
    setRefinedData(null); // Reset the previous refined output so the UI can show placeholders

    try {
      const result = await refineUserPrompt(originalPrompt); // Send the prompt to Gemini and wait for the structured response
      setRefinedData(result); // Save the returned data for display
      setStatus(AppStatus.SUCCESS); // Flip the UI into the success state
    } catch (err) {
      setStatus(AppStatus.ERROR); // Mark the UI as errored if the call fails
      if (err instanceof Error) setErrorMsg(err.message); // Surface the native error message when possible
      else setErrorMsg("An unexpected error occurred."); // Fall back to a generic error string
    }
  }, [originalPrompt]); // Recreate the callback whenever the prompt changes

  const handleInject = useCallback(() => { // Declare the function that pushes the refined prompt back into the chat input
    if (!refinedData?.refinedPrompt || !isExtension) return; // Abort when there’s nothing to inject or we aren’t inside the extension

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => { // Look up the active tab so we can message its content script
      if (tabs[0]?.id) { // Only proceed if a valid tab ID exists
        chrome.tabs.sendMessage( // Send the refined text to the content script
          tabs[0].id, // Target the active tab
          { type: MessageType.INJECT_TEXT, payload: refinedData.refinedPrompt }, // Provide the refined text via the unified message schema
          () => {
            if (chrome.runtime.lastError) { // If Chrome failed to deliver the message
              setErrorMsg('Could not inject. Refresh page and try again.'); // Inform the user so they can recover
            }
          }
        );
      }
    });
  }, [refinedData]); // Recreate the callback when the refined response changes

  const handleCopy = () => { // Define the helper to copy the refined text to the clipboard
    if (refinedData?.refinedPrompt) { // Only run when we have text available
      navigator.clipboard.writeText(refinedData.refinedPrompt); // Use the Clipboard API to copy the text
      setCopied(true); // Flip the “Copied” label on the button
      setTimeout(() => setCopied(false), 2000); // Reset the label after two seconds
    }
  };

  const handleClear = () => { // Define the helper that clears the prompt and resets the UI
    setOriginalPrompt(''); // Wipe the textarea text
    setRefinedData(null); // Remove any refined output currently displayed
    setStatus(AppStatus.IDLE); // Reset the status banner
    setErrorMsg(''); // Clear error messaging
  };

  return ( // Render the popup’s JSX layout
    <div className="min-h-screen bg-main text-gray-200 font-sans p-5 flex flex-col gap-5"> {/* Outer container with padding and theming */}
      
      {/* 1. Header */}
      <header className="flex items-center justify-between"> {/* Header row with logo and status chip */}
        <div className="flex items-center gap-3"> {/* Group the logo and brand text */}
          {/* Logo: Purple gradient circle with custom white Quill SVG */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#6366f1] to-[#a855f7] flex items-center justify-center shadow-lg shadow-indigo-500/20"> {/* Gradient circle behind the feather icon */}
             <FeatherLogo className="w-5 h-5 transform rotate-[-10deg]" /> {/* White feather glyph */}
          </div>
          <div className="flex flex-col justify-center"> {/* Column for the name text */}
             <span className="text-lg font-semibold tracking-tight text-white">Prompt Smith</span> {/* Brand label */}
          </div>
        </div>
        <div className="px-3 py-1 rounded-full bg-[#1f2937] border border-[#374151] flex items-center gap-2 shadow-sm"> {/* Status pill showing API connection */}
          <span className="text-xs font-medium text-[#10b981]">Gemini linked</span> {/* Text that indicates the API is configured */}
        </div>
      </header>

      {/* 2. Error Banner */}
      {status === AppStatus.ERROR && ( // Show the alert banner only when an error is active
        <div className="bg-error/10 border border-error/20 rounded-lg p-3 flex items-center gap-3 animate-fade-in"> {/* Styled container for the error message */}
          <AlertCircle className="w-5 h-5 text-error shrink-0" /> {/* Red icon to draw attention */}
          <p className="text-xs font-medium text-error/90">{errorMsg}</p> {/* Display the latest error string */}
        </div>
      )}

      {/* 3. Input Card */}
      <section className="bg-card border border-border rounded-xl overflow-hidden shadow-sm"> {/* Card that wraps the prompt editor */}
        <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-[#1A1E26]"> {/* Card header with label and character count */}
          <h2 className="text-sm font-medium text-gray-400">Input Prompt</h2> {/* Section title */}
          <span className="text-xs text-gray-600 font-mono">{originalPrompt.length} chars</span> {/* Live character count */}
        </div>
        <div className="p-4 relative group"> {/* Container for the textarea */}
          <textarea
            className="w-full h-28 bg-transparent text-sm text-gray-200 p-2 outline-none resize-none placeholder:text-gray-700 font-mono leading-relaxed border border-gray-800/60 rounded-lg focus:border-brand/50 transition-colors" // Styled textarea
            placeholder="e.g. Write a blog post about AI..." // Hint text for the user
            value={originalPrompt} // Bind the textarea value to component state
            onChange={(e) => setOriginalPrompt(e.target.value)} // Update state when the user types
          />
        </div>
        <div className="px-4 py-3 border-t border-border bg-[#12151d] flex items-center justify-between text-xs text-gray-500 gap-2"> {/* Footer row with sync and clear buttons */}
          <button
            onClick={() => fetchActivePrompt(true)} // Force a sync with the content script when clicked
            disabled={syncingInput || !isExtension} // Disable if we’re already syncing or not in the extension
            className="px-3 py-2 rounded-lg border border-gray-800 hover:border-brand/60 hover:text-white transition-all flex items-center gap-2 disabled:opacity-40" // Button styling
          >
            {syncingInput && ( // Show a spinner if we are currently syncing
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            )}
            <span>{syncingInput ? 'Syncing…' : 'Load from chat'}</span> {/* Button text that reflects the current sync state */}
          </button>
          <button
            onClick={handleClear} // Clear the prompt when clicked
            className="px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all" // Styling for the clear action
          >
            Clear {/* Label for the clear button */}
          </button>
        </div>
      </section>

      {/* 4. Refined Output (Conditional) */}
      {refinedData && ( // Render the refined output card only when we have data from Gemini
        <section className="animate-slide-up"> {/* Animate the section as it appears */}
           <div className="flex items-center justify-between mb-3 px-1"> {/* Section header */}
              <span className="text-sm font-bold text-brand uppercase tracking-wider">Refined Output</span> {/* Label describing the section */}
           </div>
           
           <div className="bg-card border border-brand rounded-xl overflow-hidden shadow-2xl shadow-brand/10 relative"> {/* Container for the refined text and score */}
              
              <div className="p-5 flex gap-4"> {/* Layout the text and chart side by side */}
                 <div className="flex-1 min-w-0"> {/* Text column */}
                    <p className="text-sm text-gray-200 whitespace-pre-wrap leading-6 font-normal"> {/* Preserve formatting and show the refined prompt */}
                      {refinedData.refinedPrompt} {/* The refined text returned by Gemini */}
                    </p>
                    
                    {/* Critique Snippet - Matching screenshot style */}
                    <div className="mt-6 pt-4 border-t border-gray-800/50"> {/* Divider above the critique quote */}
                      <div className="flex items-start gap-2.5"> {/* Layout bullet and text */}
                        <div className="mt-1.5 w-2 h-2 rounded-full bg-yellow-500 shrink-0 shadow-sm shadow-yellow-500/50"></div> {/* Small glowing indicator */}
                        <p className="text-xs text-gray-400 italic leading-relaxed">"{refinedData.critique}"</p> {/* Display the critique snippet */}
                      </div>
                    </div>
                 </div>
                 
                 {/* Score Section */}
                 <div className="shrink-0 pt-1 pl-2"> {/* Column reserved for the score chart */}
                    <ScoreChart score={refinedData.score} critique={refinedData.critique} /> {/* Render the donut chart using the returned score */}
                 </div>
              </div>

              {/* Footer Actions */}
              <div className="bg-black/30 border-t border-border grid grid-cols-2"> {/* Action bar with copy and inject buttons */}
                 <button 
                    onClick={handleCopy} // Copy the refined prompt when clicked
                    className="py-3 flex items-center justify-center gap-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors border-r border-border group" // Styling for the copy button
                 >
                    {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 group-hover:text-gray-300" />} {/* Swap icon based on whether copy just occurred */}
                    {copied ? "Copied" : "Copy"} {/* Switch the button label after copying */}
                 </button>
                 <button 
                    onClick={handleInject} // Inject the refined text back into the chat when clicked
                    disabled={!isExtension} // Guard against running outside the extension
                    className="py-3 flex items-center justify-center gap-2 text-xs font-medium text-gray-400 hover:text-brand hover:bg-brand/5 transition-colors disabled:opacity-30 group" // Styling for the inject button
                 >
                    <Download className="w-4 h-4 group-hover:text-brand" /> {/* Icon that implies sending text downward */}
                    Inject {/* Label for the inject action */}
                 </button>
              </div>
           </div>
        </section>
      )}

      {/* 5. Action Button (Bottom) */}
      {!refinedData && ( // Only show the “Refine Prompt” button while we’re waiting for a result
        <button
          onClick={handleRefine} // Trigger the Gemini call
          disabled={status === AppStatus.LOADING || !originalPrompt.trim()} // Disable while loading or when there’s no prompt
          className="w-full py-4 bg-brand hover:bg-brand/90 rounded-xl text-white font-semibold shadow-lg shadow-brand/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 group" // Button styling
        >
          {status === AppStatus.LOADING ? ( // Swap content depending on loading state
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> {/* Spinner while waiting */}
              <span>Refining...</span> {/* Text shown during the refinement call */}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 fill-white/20 animate-pulse" /> {/* Decorative icon when idle */}
              <span>Refine Prompt</span> {/* Default button label */}
            </>
          )}
        </button>
      )}
      
      {/* Reset/Try Again Button when refined */}
      {refinedData && ( // Offer a reset option only when a result is visible
         <div className="mt-2 text-center"> {/* Container for the reset link */}
            <button 
               onClick={() => { setRefinedData(null); setStatus(AppStatus.IDLE); }} // Clear the refined output so the user can run again
               className="text-xs text-gray-500 hover:text-brand transition-colors" // Styling for the subtle reset button
            >
               Refine another prompt {/* Reset label */}
            </button>
         </div>
      )}

      {/* Footer Tip */}
      {!refinedData && ( // Show the tip only when the refined output isn’t taking up the bottom space
        <div className="mt-auto text-center pt-4"> {/* Footer placement */}
          <p className="text-[10px] text-gray-600">
            Pro Tip: Works with ChatGPT, Gemini, and Claude. {/* Friendly reminder about supported sites */}
          </p>
        </div>
      )}
    </div>
  );
};

export default App; // Export the component so Vite/React can render it
