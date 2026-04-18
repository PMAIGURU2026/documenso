# Accessibility Testing Specifications
## Verification Portal — Issue #1764
## Owner: Pape (UX & Accessibility)

---

## Overview
This document specifies WCAG 2.1 AA compliance requirements, keyboard navigation, 
screen reader support, and color contrast standards for the Verification Portal.

---

## 1. WCAG 2.1 AA Success Criteria Checklist

### 1.1 Perceivable

#### 1.1.1 Non-text Content (Level A)
- [ ] All icons (✓, ✗, ⛔, ⚠️) have text labels alongside them
- [ ] Result state colors are accompanied by text (never color-only)
- [ ] No decorative images; all meaningful images have alt text

**Implementation:**
```jsx
// Correct: Icon + Text
<div className="result-state">
  <span className="icon">✓</span>
  <span className="label">Valid Signature</span>
</div>

// Incorrect: Icon only (fails WCAG 1.1.1)
<span className="icon">✓</span> Valid Signature
```

#### 1.1.2 Text Formatting (Level A)
- [ ] All text is HTML text (not images of text)
- [ ] Font sizes are scalable (use rem/em, not fixed px)
- [ ] No crucial information conveyed through color alone

**Implementation:**
```css
/* Correct: Scalable units */
.result-title {
  font-size: 1.5rem; /* Scales with user zoom */
}

/* Incorrect: Fixed pixels */
.result-title {
  font-size: 24px; /* Does not scale */
}
```

#### 1.4.3 Contrast (Minimum) (Level AA) — CRITICAL
All text must have a contrast ratio of **at least 4.5:1** (normal text) 
or **3:1** (large text 18pt+).

**Color Testing:**
```
✓ Green text #16A34A on white #FFFFFF: ratio = 5.2:1 ✓ PASS
✗ Red text #DC2626 on white #FFFFFF: ratio = 5.5:1 ✓ PASS
⚠️ Orange text #92400E on white #FFFFFF: ratio = 8.1:1 ✓ PASS
```

**Test Tool:** 
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- WAVE Browser Extension: https://wave.webaim.org/extension/
- Axe DevTools: https://www.deque.com/axe/devtools/

**Checklist:**
- [ ] All result state text meets 4.5:1 contrast minimum
- [ ] All disclaimer text meets 4.5:1 contrast minimum
- [ ] Privacy notice meets 4.5:1 contrast minimum
- [ ] Form labels meet 4.5:1 contrast minimum
- [ ] Error messages meet 4.5:1 contrast minimum
- [ ] Button text meets 4.5:1 contrast minimum
- [ ] Tested in both light and dark modes

---

### 1.2 Operable

#### 2.1.1 Keyboard (Level A)
**All functionality must be operable via keyboard alone (no mouse required).**

##### Drag-and-Drop Fallback
The upload interface uses drag-and-drop, which is not keyboard-accessible. 
A keyboard-accessible file picker **MUST** be provided as an alternative.

```jsx
// Implementation Example
const FileUpload = () => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      {/* Drag-and-drop zone (mouse users) */}
      <div
        onDrop={handleDrop}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
        aria-describedby="drag-hint"
        className="drag-zone"
      >
        <p id="drag-hint">Drag and drop your PDF here, or use the button below</p>
      </div>

      {/* Keyboard-accessible file picker (REQUIRED) */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="btn-primary"
      >
        Choose File
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        aria-label="Upload PDF file for verification"
      />
    </div>
  );
};
```

**Keyboard Navigation Checklist:**
- [ ] Tab key moves focus to all interactive elements in logical order
- [ ] Enter or Space activates buttons
- [ ] File input is accessible without mouse (click button → native file picker)
- [ ] Result states are keyboard-navigable (if collapsible)
- [ ] Links can be focused and activated with Enter key
- [ ] No keyboard traps (can always move focus away from element)

#### 2.1.2 No Keyboard Trap (Level A)
- [ ] Focus can be moved away from any element using Tab or Shift+Tab
- [ ] No elements lock keyboard focus (e.g., modal without Escape to close)
- [ ] Form inputs don't capture Tab key for navigation

#### 2.4.7 Focus Visible (Level AA)
All interactive elements must have a visible focus indicator when navigated via keyboard.

```css
/* Required: Visible focus indicator */
button:focus,
input:focus,
a:focus {
  outline: 2px solid #6366F1; /* Minimum 2px outline */
  outline-offset: 2px;
}

/* Incorrect: Focus removed (accessibility violation) */
button:focus {
  outline: none; /* NEVER do this without alternative */
}

/* Alternative: Custom focus style */
button:focus-visible {
  background-color: #f0f0f0;
  border: 2px solid #000;
  outline: 3px solid #FFD700;
}
```

**Testing:**
1. Navigate page with Tab key only
2. Verify blue/colored outline around every button, link, and input
3. Outline must be at least 2px thick and visible

---

### 1.3 Understandable

#### 3.3.1 Error Identification (Level A)
When errors occur, they must be clearly identified and described.

```jsx
// Correct: Clear error message
<div role="alert" aria-live="polite" className="error-box">
  ✗ File must be a valid PDF. You selected: document.txt
</div>

// Incorrect: Generic error
<div className="error">Error occurred</div>
```

#### 3.3.2 Labels or Instructions (Level A)
All form inputs must have labels, either visible or aria-labeled.

```jsx
{/* Correct: Visible label */}
<label htmlFor="file-upload">Upload PDF:</label>
<input id="file-upload" type="file" accept=".pdf" />

{/* Also correct: aria-label */}
<input
  type="file"
  accept=".pdf"
  aria-label="Upload PDF file for verification"
/>
```

---

### 1.4 Robust

#### 4.1.2 Name, Role, Value (Level A)
All components must have proper semantic HTML or ARIA attributes.

```jsx
// Result State Components
<div
  role="status"
  aria-live="polite"
  aria-label="Signature verification result"
  className="result-state"
>
  <div className="icon">✓</div>
  <h2>Valid Signature</h2>
  <p>This PDF contains a valid, cryptographically intact signature...</p>
</div>

// Buttons
<button
  aria-label="Open certificate details"
  aria-expanded={isOpen}
  aria-controls="cert-details-panel"
>
  View Certificate Chain
</button>

// Links
<a href="#" aria-label="Open external link: Adobe Approved Trust List (new window)">
  Adobe Approved Trust List ↗
</a>
```

#### 4.1.3 Status Messages (Level AA)
Messages that appear without focus (e.g., success notifications) must be announced 
to screen readers using `role="status"` and `aria-live="polite"`.

```jsx
// Correct: Screen reader announces "File uploaded successfully"
<div role="status" aria-live="polite">
  ✓ File uploaded successfully. Processing...
</div>

// Incorrect: Screen reader never announces this
<div className="success-message">✓ File uploaded successfully</div>
```

---

## 2. Color Contrast Matrix

### Result States

| State | Foreground | Background | Contrast | Pass |
|-------|-----------|-----------|----------|------|
| GREEN text | #16A34A | #FFFFFF | 5.2:1 | ✓ |
| AMBER text | #92400E | #FFFFFF | 8.1:1 | ✓ |
| RED text | #991B1B | #FFFFFF | 7.8:1 | ✓ |
| Disclaimer text | #6B7280 | #FFFFFF | 4.5:1 | ✓ |
| Disclaimer box text | #1F2937 | #F3F4F6 | 12.6:1 | ✓ |

### Accessible Color Palette

```css
/* Use these approved colors for legal compliance */
:root {
  /* Success states */
  --color-success-dark: #166534;   /* 5.5:1 on white */
  --color-success-light: #DCFCE7;
  --color-success-border: #86EFAC;

  /* Warning states */
  --color-warning-dark: #92400E;   /* 8.1:1 on white */
  --color-warning-light: #FFFBEB;
  --color-warning-border: #FCD34D;

  /* Error states */
  --color-error-dark: #991B1B;     /* 7.8:1 on white */
  --color-error-light: #FEE2E2;
  --color-error-border: #F87171;

  /* Neutral text */
  --color-text-primary: #1F2937;   /* 16:1 on white */
  --color-text-secondary: #6B7280; /* 4.5:1 on white */
  --color-text-muted: #9CA3AF;     /* 3.5:1 on white — avoid for critical content */
}
```

---

## 3. Screen Reader Testing

### Tools
- **NVDA** (free, Windows): https://www.nvaccess.org/
- **JAWS** (paid, Windows): https://www.freedomscientific.com/
- **VoiceOver** (built-in, macOS/iOS): Cmd+F5
- **TalkBack** (built-in, Android)

### Test Cases

#### Test 1: Upload Form Announcement
**Expected flow:**
```
Screen reader says: "Upload PDF file for verification"
User presses Tab → focus moves to "Choose File" button
Screen reader says: "Choose File, button"
User presses Enter → native file picker opens
```

#### Test 2: Result State Announcement
**Expected flow:**
```
User selects PDF and submits
Screen reader announces: "Signature verification result"
Screen reader announces: "Valid Signature"
Screen reader reads: "This PDF contains a valid, cryptographically intact signature..."
Screen reader announces disclaimer text
```

#### Test 3: Expandable Sections
**Expected flow:**
```
Screen reader says: "View Certificate Chain, button, collapsed"
User presses Enter
Screen reader says: "View Certificate Chain, button, expanded"
Screen reader reads expanded certificate details
```

### Checklist
- [ ] All form labels are announced correctly
- [ ] Result states are announced with role="status" and aria-live="polite"
- [ ] Error messages are announced immediately
- [ ] Expandable sections announce expand/collapse state
- [ ] Buttons announce their purpose clearly
- [ ] Links announce external link designation (if applicable)

---

## 4. Keyboard Navigation Test

### Procedure
1. Disable mouse/trackpad entirely
2. Navigate the entire portal using Tab, Shift+Tab, Enter, Space, Escape
3. Verify all interactive elements are reachable

### Test Matrix

| Element | Tab | Enter/Space | Expected |
|---------|-----|------------|----------|
| File input button | ✓ | Opens file picker | Reachable |
| Upload submit | ✓ | Submits form | Reachable |
| Disclaimer links | ✓ | Opens URL | Reachable |
| Expand buttons | ✓ | Toggles section | Reachable |
| Result state links | ✓ | Opens link | Reachable |

---

## 5. Color Blindness Simulation

Use tools to verify the interface works for users with color blindness:

### Tools
- **Coblis**: http://www.color-blindness.com/coblis-color-blindness-simulator/
- **Chromatic Vision Simulator**: https://asada.tukusi.ne.jp/colorvisioncheck/
- **Chrome DevTools**: Right-click → Inspect → Rendering → Emulate CSS media feature prefers-color-scheme

### Test Cases
1. **Red-blind (Protanopia)**: Red and green appear as shades of yellow/brown
   - Verify RED and GREEN states are distinguishable not by color alone
   
2. **Green-blind (Deuteranopia)**: Green and red appear as shades of yellow/brown
   - Same verification as red-blind

3. **Blue-yellow-blind (Tritanopia)**: Blue and yellow appear reversed
   - Verify AMBER states are still visible

### Required: Non-Color Indicators
- ✓ Icon + Text for success (not green alone)
- ✗ Icon + Text for error (not red alone)
- ⚠️ Icon + Text for warning (not yellow alone)

---

## 6. Zoom & Text Scaling

### Requirements
- [ ] Page remains usable at 200% zoom (no horizontal scrollbar)
- [ ] Text reflows correctly at 200% zoom
- [ ] Buttons remain clickable at 200% zoom (minimum 44x44px)
- [ ] Form inputs remain usable at 200% zoom

### Testing Procedure
1. Open portal in browser
2. Press Ctrl++ five times (or Cmd++ on Mac) to zoom to 200%
3. Verify all content is readable and functional without horizontal scrolling

---

## 7. Automated Testing Setup

### Axe DevTools (Recommended)
```bash
npm install --save-dev @axe-core/react
```

```jsx
import { axe, toHaveNoViolations } from 'jest-axe';

describe('Verification Portal — Accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(<VerificationPortal />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### WAVE (WebAIM)
```bash
npm install --save-dev wave-cli
```

### Lighthouse (Built-in to Chrome)
1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Run Accessibility audit
4. Target: 90+ score

---

## 8. Pre-Launch Accessibility Audit (Pape)

| Item | Test Method | Result | Notes |
|------|------------|--------|-------|
| WCAG 2.1 AA automated scan | Axe DevTools | [ ] Pass | 0 violations |
| Manual keyboard navigation | Keyboard only | [ ] Pass | All interactive elements reachable |
| Screen reader testing (NVDA) | NVDA for Windows | [ ] Pass | All labels announced correctly |
| Screen reader testing (VoiceOver) | VoiceOver on macOS | [ ] Pass | All labels announced correctly |
| Color contrast verification | WebAIM Contrast | [ ] Pass | All text 4.5:1+ |
| Color blindness simulation | Coblis | [ ] Pass | Non-color indicators work |
| Zoom testing (200%) | Browser zoom | [ ] Pass | No horizontal scroll |
| Focus indicators visible | Manual inspection | [ ] Pass | 2px+ outline visible |
| Drag-and-drop fallback | Keyboard only | [ ] Pass | File picker works |
| Error message announcement | Screen reader | [ ] Pass | Errors announced as alerts |
| Lighthouse score | Chrome Lighthouse | [ ] ≥90 | Accessibility score |

---

## 9. Accessibility Statement (For Website)

> **Accessibility Commitment**
> 
> The Documenso Verification Portal is designed to meet WCAG 2.1 Level AA accessibility standards. 
> We are committed to ensuring that our tool is usable by everyone, including people with disabilities.
> 
> **Supported Technologies:**
> - Keyboard navigation (Tab, Enter, Space, Escape)
> - Screen readers (NVDA, JAWS, VoiceOver, TalkBack)
> - Zoom up to 200% without loss of functionality
> - High contrast modes
> 
> **Known Issues:** (if any)
> - [Issue]: [Workaround]
> 
> **Report Accessibility Issues:**
> If you encounter any accessibility barriers, please contact [accessibility@documenso.com](mailto:accessibility@documenso.com) 
> with details of the issue and your assistive technology.

---

## Questions for Pape

1. **Current accessibility baseline**: What is Documenso's existing WCAG compliance level?
2. **Screen reader priority**: NVDA, JAWS, VoiceOver, or all three?
3. **Assistive tech budget**: Are there specific AT tools we should prioritize testing with?
4. **Dark mode**: Should the portal support dark mode (e.g., `prefers-color-scheme`)?
5. **Font preferences**: Should the portal respect `prefers-reduced-motion` and `prefers-reduced-transparency`?

---

## Related Documents

- DISCLAIMER_COPY_ARCHIVE.md — User-facing text (ensure contrast ratios)
- BACKEND_IMPLEMENTATION_GUIDE.md — Error handling & user feedback
- compliance-report.tsx — GAP-10 (Accessibility & Legal)
