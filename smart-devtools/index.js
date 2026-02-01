// index.js
(function () {
    const { React } = window;
    const { api } = RelayCraft;

    const { Button, Input, Select, Textarea } = RelayCraft.components || {};
    const { Editor, DiffEditor, Markdown } = api.ui.components || {};

    const t = (k, opts) => (api.ui && api.ui.t) ? api.ui.t(k, opts) : k;

    // --- Premium CSS Injection ---
    const styleId = 'smart-devtools-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .devtools-panel {
                background: var(--color-card);
                border: 1px solid var(--color-border);
                border-radius: 8px;
                position: relative;
                transition: border-color 0.2s;
            }
            .devtools-panel:focus-within {
                border-color: var(--color-primary);
            }
            .devtools-textarea {
                background: var(--color-muted);
                border: 1px solid var(--color-border) !important;
                border-radius: 8px !important;
                padding: 10px !important;
                font-family: var(--font-mono) !important;
                font-size: 13px !important;
                color: var(--color-foreground) !important;
                resize: none;
                transition: all 0.2s;
            }
            .devtools-textarea::placeholder {
                font-family: var(--font-mono) !important;
                opacity: 0.5;
            }
            .devtools-textarea:focus {
                outline: none;
                border-color: var(--color-primary) !important;
                background: var(--color-card) !important;
                box-shadow: 0 0 0 2px var(--color-primary-20);
            }
            .tab-active {
                background: var(--color-primary) !important;
                color: white !important;
                box-shadow: 0 4px 12px -2px rgba(59, 130, 246, 0.4);
            }
            .section-label {
                text-transform: uppercase;
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.05em;
                color: var(--color-muted-foreground);
                margin-bottom: 0px;
                display: inline-block;
                opacity: 0.7;
                vertical-align: middle;
            }
            .jwt-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; vertical-align: middle; position: relative; top: -1px; }
            .jwt-header { color: #fb7185; } .jwt-header-bg { background: #fb7185; }
            .jwt-payload { color: #d8b4fe; } .jwt-payload-bg { background: #d8b4fe; }
            .jwt-signature { color: #4ade80; } .jwt-signature-bg { background: #4ade80; }
            
            .base64-preview-img {
                max-width: 100%;
                max-height: 200px;
                border-radius: 8px;
                border: 1px solid var(--color-border);
                margin-top: 8px;
            }

            @keyframes pulse-subtle {
                0% { opacity: 0.8; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.005); border-color: var(--color-primary); }
                100% { opacity: 0.8; transform: scale(1); }
            }
            .animate-pulse-subtle {
                animation: pulse-subtle 0.8s ease-in-out 1;
            }
        `;
        document.head.appendChild(style);
    }

    // --- Icons ---
    const Icons = {
        Key: (props) => React.createElement('svg', { ...props, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, React.createElement('circle', { cx: "7.5", cy: "15.5", r: "5.5" }), React.createElement('path', { d: "m21 2-9.6 9.6" }), React.createElement('path', { d: "m15.5 7.5 3 3L22 7l-3-3" })),
        Sparkles: (props) => React.createElement('svg', { ...props, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, React.createElement('path', { d: "m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" }), React.createElement('path', { d: "M5 3v4" }), React.createElement('path', { d: "M9 3v4" }), React.createElement('path', { d: "M3 5h4" }), React.createElement('path', { d: "M3 9h4" })),
        GitCompare: (props) => React.createElement('svg', { ...props, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, React.createElement('circle', { cx: "18", cy: "18", r: "3" }), React.createElement('circle', { cx: "6", cy: "6", r: "3" }), React.createElement('path', { d: "M13 6h3a2 2 0 0 1 2 2v7" }), React.createElement('path', { d: "M11 18H8a2 2 0 0 1-2-2V9" })),
        FileJson: (props) => React.createElement('svg', { ...props, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, React.createElement('path', { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }), React.createElement('path', { d: "M14 2v4a2 2 0 0 0 2 2h4" }), React.createElement('path', { d: "M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1" }), React.createElement('path', { d: "M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1" })),
        Binary: (props) => React.createElement('svg', { ...props, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, React.createElement('rect', { x: "14", y: "14", width: "4", height: "6", rx: "2" }), React.createElement('rect', { x: "6", y: "4", width: "4", height: "6", rx: "2" }), React.createElement('path', { d: "M6 20h4" }), React.createElement('path', { d: "M14 10h4" }), React.createElement('path', { d: "M6 14h2v6" }), React.createElement('path', { d: "M14 4h2v6" })),
        Clock: (props) => React.createElement('svg', { ...props, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, React.createElement('circle', { cx: "12", cy: "12", r: "10" }), React.createElement('polyline', { points: "12 6 12 12 16 14" }))
    };

    // --- Components ---

    const JwtDebugger = () => {
        const [token, setToken] = React.useState('');
        const [parts, setParts] = React.useState({ header: {}, payload: {}, signature: '' });
        const [error, setError] = React.useState('');
        const [isInternalChange, setIsInternalChange] = React.useState(false);
        const [lastUpdateArea, setLastUpdateArea] = React.useState(null); // 'token' or 'parts'

        const b64Encode = (obj) => {
            try {
                const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
                const utf8Str = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) =>
                    String.fromCharCode('0x' + p1)
                );
                return btoa(utf8Str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            } catch (e) { return ''; }
        };

        const b64Decode = (str) => {
            try {
                const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
                const binary = atob(b64);
                const decoded = decodeURIComponent(Array.prototype.map.call(binary, (c) =>
                    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
                ).join(''));
                try { return JSON.parse(decoded); } catch (e) { return decoded; }
            } catch (e) { return null; }
        };

        React.useEffect(() => {
            if (isInternalChange) {
                setIsInternalChange(false);
                return;
            }
            if (!token.trim()) { setParts({ header: {}, payload: {}, signature: '' }); setError(''); return; }
            const p = token.trim().split('.');
            if (p.length !== 3) { setError(t('invalid_jwt')); return; }
            const header = b64Decode(p[0]);
            const payload = b64Decode(p[1]);
            const signature = p[2];
            if (!header || !payload) { setError(t('invalid_jwt')); return; }
            setParts({ header, payload, signature });
            setError('');
            setLastUpdateArea('token');
        }, [token]);

        const updateParts = (key, value) => {
            try {
                let parsed = value;
                if (key !== 'signature') {
                    try { parsed = JSON.parse(value); } catch (e) { }
                }
                const newParts = { ...parts, [key]: parsed };
                setParts(newParts);
                setIsInternalChange(true);
                // All parts (Header, Payload, and Signature) must be Base64Url encoded
                const newToken = `${b64Encode(newParts.header)}.${b64Encode(newParts.payload)}.${b64Encode(newParts.signature)}`;
                setToken(newToken);
                setLastUpdateArea('parts');
            } catch (e) { }
        };

        const Section = ({ title, content, type, onEdit }) => React.createElement('div', {
            className: `space-y-1 flex flex-col h-full overflow-hidden transition-all duration-300 ${lastUpdateArea === 'token' ? 'animate-pulse-subtle' : ''}`
        },
            React.createElement('div', { className: "flex items-center" },
                React.createElement('span', { className: `jwt-dot jwt-${type}-bg` }),
                React.createElement('span', { className: `section-label mb-0 jwt-${type}` }, t(title))
            ),
            React.createElement('div', { className: "flex-1 devtools-panel min-h-0" },
                React.createElement(Editor, {
                    value: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
                    onChange: onEdit, language: type === 'signature' ? 'text' : 'json',
                    options: { lineNumbers: 'off', fontSize: 13, foldGutter: false, wordWrap: 'on' }
                })
            )
        );

        return React.createElement('div', { className: "h-full flex flex-col" },
            React.createElement('div', { className: "text-[11px] text-muted-foreground/60 font-medium mt-[-14px] mb-4" }, t('jwt_subtitle')),
            React.createElement('div', { className: "space-y-4 flex-1 flex flex-col min-h-0" },
                React.createElement(Textarea, {
                    value: token, onChange: (e) => setToken(e.target.value),
                    placeholder: t('paste_jwt_placeholder'),
                    className: `devtools-textarea h-24 shrink-0 transition-all duration-300 ${lastUpdateArea === 'parts' ? 'animate-pulse-subtle' : ''}`
                }),
                !error ? React.createElement('div', { className: "flex-1 flex flex-col min-h-0 space-y-3" },
                    React.createElement('div', { className: "grid grid-cols-3 gap-4 flex-1 min-h-0" },
                        React.createElement(Section, { title: 'header', content: parts.header, type: 'header', onEdit: (v) => updateParts('header', v) }),
                        React.createElement(Section, { title: 'payload', content: parts.payload, type: 'payload', onEdit: (v) => updateParts('payload', v) }),
                        React.createElement(Section, { title: 'signature', content: parts.signature, type: 'signature', onEdit: (v) => updateParts('signature', v) })
                    )
                ) : React.createElement('div', { className: "p-4 text-xs text-destructive bg-destructive/5 rounded-lg border border-destructive/10" }, error)
            )
        );
    };

    const JsonFormatter = () => {
        const [input, setInput] = React.useState('');
        const [error, setError] = React.useState('');

        const handleFormat = (pretty = true) => {
            try {
                if (!input.trim()) return;
                const parsed = JSON.parse(input);
                setInput(pretty ? JSON.stringify(parsed, null, 4) : JSON.stringify(parsed));
                setError('');
            } catch (e) { setError(t('invalid_json')); }
        };

        return React.createElement('div', { className: "space-y-4 h-full flex flex-col" },
            React.createElement('div', { className: "flex-1 min-h-0 devtools-panel relative" },
                React.createElement(Editor, {
                    value: input,
                    onChange: setInput,
                    language: "json",
                    options: { minimap: { enabled: false }, fontSize: 13 }
                }),
                error && React.createElement('div', { className: "absolute bottom-4 left-4 text-[11px] text-destructive bg-destructive/10 px-2 py-1 rounded border border-destructive/20 z-10 font-medium" }, error)
            ),
            React.createElement('div', { className: "flex gap-2" },
                React.createElement(Button, { onClick: () => handleFormat(true), className: "gap-2" }, React.createElement(Icons.FileJson, { className: "w-4 h-4" }), t('format')),
                React.createElement(Button, { variant: "outline", onClick: () => handleFormat(false) }, t('minify')),
                React.createElement(Button, { variant: "ghost", onClick: () => setInput(''), className: "ml-auto text-muted-foreground/60" }, t('clear'))
            )
        );
    };

    const JsonDiffer = () => {
        const [left, setLeft] = React.useState('{\n  "status": "pending"\n}');
        const [right, setRight] = React.useState('{\n  "status": "completed"\n}');
        const [mode, setMode] = React.useState('edit');

        return React.createElement('div', { className: "space-y-4 h-full flex flex-col" },
            mode === 'edit' ? React.createElement('div', { className: "grid grid-cols-2 gap-4 flex-1 min-h-0" },
                [{ val: left, set: setLeft, label: 'diff_left' }, { val: right, set: setRight, label: 'diff_right' }].map(x => React.createElement('div', { key: x.label, className: "flex flex-col gap-1" },
                    React.createElement('span', { className: "section-label" }, t(x.label)),
                    React.createElement('div', { className: "flex-1 devtools-panel" },
                        React.createElement(Editor, { value: x.val, onChange: x.set, language: "json", options: { minimap: { enabled: false }, fontSize: 13 } })
                    )
                ))
            ) : React.createElement('div', { className: "flex-1 devtools-panel" },
                React.createElement(DiffEditor, {
                    original: left, modified: right, language: "json", height: "100%",
                    options: { renderSideBySide: true, minimap: { enabled: false }, automaticLayout: true, fontSize: 13 }
                })
            ),
            React.createElement(Button, { onClick: () => setMode(mode === 'edit' ? 'diff' : 'edit'), className: "gap-2 w-fit" },
                React.createElement(Icons.GitCompare, { className: "w-4 h-4" }),
                mode === 'edit' ? t('compare') : t('back_to_edit')
            )
        );
    };

    const Base64Tool = () => {
        const [input, setInput] = React.useState('');
        const [output, setOutput] = React.useState('');
        const [preview, setPreview] = React.useState(null);
        const [error, setError] = React.useState('');
        const fileInputRef = React.useRef(null);

        const encode = () => { try { setOutput(btoa(input)); setPreview(null); setError(''); } catch (e) { setOutput('Error'); } };
        const decode = () => {
            try {
                let toDecode = input.trim();
                if (toDecode.includes(',')) toDecode = toDecode.split(',')[1];
                const decoded = atob(toDecode);
                const isBinary = /[^\x20-\x7E\t\r\n]/.test(decoded);
                setOutput(isBinary ? `[Binary Data: ${decoded.length} bytes]` : decoded);
                setError('');
                if (input.trim().startsWith('data:image/') || /^[A-Za-z0-9+/=]+$/.test(toDecode)) {
                    setPreview(input.trim().startsWith('data:image/') ? input.trim() : `data:image/png;base64,${toDecode}`);
                }
            } catch (e) { setOutput('Error'); setPreview(null); }
        };

        const handleFile = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) { setError(t('invalid_file_type')); return; }
            if (file.size > 2 * 1024 * 1024) { setError(t('file_too_large')); return; }
            setError('');
            const reader = new FileReader();
            reader.onload = (ev) => {
                const b64 = ev.target.result;
                setOutput(b64); // Result of "File -> Base64" is the Data URL in Output
                setPreview(b64);
                setInput(`[File: ${file.name}]`); // Indicate which file was uploaded
            };
            reader.readAsDataURL(file);
        };

        return React.createElement('div', { className: "h-full flex flex-col gap-4 overflow-hidden" },
            React.createElement('div', { className: "flex-1 grid grid-cols-2 gap-4 min-h-0" },
                React.createElement('div', { className: "flex flex-col gap-2" },
                    React.createElement('div', { className: "flex items-center justify-between" },
                        React.createElement('span', { className: "section-label mb-0" }, t('input_label')),
                        error && React.createElement('span', { className: "text-[10px] text-destructive font-medium" }, error)
                    ),
                    React.createElement(Textarea, { value: input, onChange: (e) => setInput(e.target.value), placeholder: "Input...", className: "devtools-textarea flex-1" }),
                    React.createElement('div', { className: "flex gap-2" },
                        React.createElement(Button, { onClick: encode, className: "flex-1" }, t('encode')),
                        React.createElement(Button, { variant: "outline", onClick: decode, className: "flex-1" }, t('decode')),
                        React.createElement('label', { className: "cursor-pointer" },
                            React.createElement(Button, {
                                variant: "ghost", className: "w-10 p-0",
                                onClick: (e) => { e.preventDefault(); fileInputRef.current.click(); }
                            },
                                React.createElement('svg', { viewBox: "0 0 24 24", width: "16", height: "16", stroke: "currentColor", strokeWidth: "2", fill: "none" }, React.createElement('path', { d: "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" }), React.createElement('line', { x1: "16", y1: "5", x2: "22", y2: "5" }), React.createElement('line', { x1: "19", y1: "2", x2: "19", y2: "8" }))
                            ),
                            React.createElement('input', { type: "file", ref: fileInputRef, className: "hidden", accept: "image/*", onChange: handleFile })
                        )
                    )
                ),
                React.createElement('div', { className: "flex flex-col gap-2" },
                    React.createElement('span', { className: "section-label" }, t('output_label')),
                    React.createElement(Textarea, { value: output, readOnly: true, placeholder: "Output...", className: "devtools-textarea flex-1" }),
                    preview && React.createElement('div', { className: "shrink-0" },
                        React.createElement('span', { className: "section-label" }, t('image_preview')),
                        React.createElement('img', { src: preview, className: "base64-preview-img", onError: () => setPreview(null) })
                    )
                )
            )
        );
    };

    const TimestampTool = () => {
        const [val, setVal] = React.useState(Math.floor(Date.now() / 1000).toString());
        const [date, setDate] = React.useState(new Date().toISOString());
        const [unit, setUnit] = React.useState('s'); // 's' or 'ms'

        const handleTsToDate = (tsVal) => {
            const v = parseInt(tsVal);
            if (isNaN(v)) return;
            const d = new Date(tsVal.length <= 10 ? v * 1000 : v);
            if (!isNaN(d.getTime())) setDate(d.toISOString());
        };

        const handleDateToTs = (dVal, forceUnit) => {
            const d = new Date(dVal);
            const time = d.getTime();
            if (isNaN(time)) return;
            const actualUnit = forceUnit || unit;
            setVal(actualUnit === 'ms' ? time.toString() : Math.floor(time / 1000).toString());
        };

        return React.createElement('div', { className: "space-y-6 max-w-lg devtools-panel p-6" },
            React.createElement('div', { className: "space-y-3" },
                React.createElement('div', { className: "flex items-center justify-between" },
                    React.createElement('span', { className: "section-label mb-0" }, t('timestamp')),
                    React.createElement('div', { className: "flex bg-muted rounded-lg p-0.5 border border-border" },
                        ['s', 'ms'].map(u => React.createElement('button', {
                            key: u, onClick: () => { setUnit(u); handleDateToTs(date, u); },
                            className: `px-3 py-1 text-[10px] font-bold rounded-md transition-all ${unit === u ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`
                        }, t(`unit_${u}`)))
                    )
                ),
                React.createElement('div', { className: "flex gap-2" },
                    React.createElement(Input, { value: val, onChange: (e) => { setVal(e.target.value); handleTsToDate(e.target.value); }, className: "devtools-textarea h-10 flex-1 px-3" }),
                    React.createElement(Button, { variant: "outline", className: "h-10 px-4", onClick: () => handleTsToDate(val) }, t('to_date'))
                )
            ),
            React.createElement('div', { className: "space-y-3" },
                React.createElement('span', { className: "section-label mb-0" }, "Date ISO / Local String"),
                React.createElement('div', { className: "flex gap-2" },
                    React.createElement(Input, { value: date, onChange: (e) => { setDate(e.target.value); handleDateToTs(e.target.value); }, className: "devtools-textarea h-10 flex-1 px-3" }),
                    React.createElement(Button, { variant: "outline", className: "h-10 px-4", onClick: () => handleDateToTs(date) }, t('to_timestamp'))
                )
            ),
            React.createElement('div', { className: "pt-2 flex justify-between items-center" },
                React.createElement(Button, {
                    variant: "ghost", size: "sm", className: "text-primary h-8 px-2 bg-primary/5 hover:bg-primary/10",
                    onClick: () => { const now = Date.now(); setVal(unit === 'ms' ? now.toString() : Math.floor(now / 1000).toString()); setDate(new Date(now).toISOString()); }
                }, React.createElement(Icons.Clock, { className: "w-3.5 h-3.5 mr-2" }), t('now'))
            )
        );
    };

    const AIConverter = () => {
        const [input, setInput] = React.useState('');
        const [promptKey, setPromptKey] = React.useState('json_ts');
        const [output, setOutput] = React.useState('');
        const [loading, setLoading] = React.useState(false);
        const [showRaw, setShowRaw] = React.useState(false);

        // Simple language detection heuristic
        const detectLanguage = (code) => {
            if (!code.trim()) return 'text';
            const trimmed = code.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
            if (trimmed.includes('import ') || trimmed.includes('export ') || trimmed.includes('const ') || trimmed.includes('function ')) return 'typescript';
            if (trimmed.includes('def ') || trimmed.includes('import ') && trimmed.includes('requests')) return 'python';
            if (trimmed.startsWith('curl ')) return 'shell';
            return 'typescript'; // Default to TS for explanation as requested
        };

        const langMap = {
            "json_ts": { in: 'json', out: 'typescript' },
            "curl_py": { in: 'shell', out: 'python' },
            "fmt_json": { in: 'json', out: 'json' },
            "explain": { in: detectLanguage(input), out: 'markdown' }
        };

        const handleConvert = async () => {
            if (!input.trim()) return;
            setLoading(true);
            try {
                // Ensure AI output is strictly professional and clean Markdown
                const systemPrompt = t('ai_system_instruction') +
                    "\n\nTECHNICAL MARKDOWN RULES:\n" +
                    "1. Use standard Markdown ONLY. NO HTML tags (like <input>).\n" +
                    "2. Use single backticks `word` for short keywords or inline code.\n" +
                    "3. Use triple backticks ONLY for multi-line code blocks.\n" +
                    "4. Avoid stray backticks or characters.";

                const response = await api.ai.chat([
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `${t(`prompts.${promptKey}`)}:\n${input}` }
                ]);
                setOutput(response);
            } catch (e) { setOutput(`Error: ${e.message}`); }
            finally { setLoading(false); }
        };

        return React.createElement('div', { className: "h-full flex flex-col gap-4 overflow-hidden" },
            React.createElement('div', { className: "flex items-center gap-4 bg-muted/30 p-2 rounded-lg border border-border/40" },
                React.createElement('div', { className: "flex-1 flex gap-2" },
                    [
                        { id: 'json_ts', icon: Icons.FileJson }, { id: 'curl_py', icon: Icons.Sparkles },
                        { id: 'fmt_json', icon: Icons.Binary }, { id: 'explain', icon: Icons.Clock }
                    ].map(p => React.createElement(Button, {
                        key: p.id, variant: promptKey === p.id ? 'default' : 'ghost',
                        size: "sm", className: `h-8 px-3 text-[11px] font-bold ${promptKey === p.id ? 'shadow-sm' : ''}`,
                        onClick: () => { setPromptKey(p.id); setShowRaw(false); }
                    }, t(`prompt_labels.${p.id}`)))
                ),
                React.createElement(Button, {
                    onClick: handleConvert, disabled: loading || !input,
                    className: "h-8 px-4 gap-2 shadow-lg shadow-primary/10"
                }, loading ? t('thinking') : React.createElement(React.Fragment, null, React.createElement(Icons.Sparkles, { className: "w-3.5 h-3.5" }), t('convert')))
            ),
            React.createElement('div', { className: "flex-1 grid grid-cols-2 gap-4 min-h-0" },
                React.createElement('div', { className: "flex flex-col gap-2" },
                    React.createElement('span', { className: "section-label" }, t('input_label')),
                    React.createElement('div', { className: "flex-1 devtools-panel" },
                        React.createElement(Editor, { value: input, onChange: setInput, language: langMap[promptKey].in, options: { fontSize: 13, lineNumbers: 'off', wordWrap: 'on' } })
                    )
                ),
                React.createElement('div', { className: "flex flex-col gap-2 min-h-0" },
                    React.createElement('div', { className: "flex items-center justify-between" },
                        React.createElement('span', { className: "section-label" }, t('output_label')),
                        promptKey === 'explain' && React.createElement('button', {
                            onClick: () => setShowRaw(!showRaw),
                            className: `text-[10px] px-2 py-0.5 rounded border font-bold transition-all ${showRaw ? 'bg-primary text-white border-primary shadow-sm' : 'border-border hover:bg-muted text-muted-foreground'}`
                        }, showRaw ? 'Markdown' : 'RAW')
                    ),
                    React.createElement('div', { className: "flex-1 devtools-panel overflow-hidden relative" },
                        (promptKey === 'explain' && !showRaw) ?
                            React.createElement('div', { className: "absolute inset-0" },
                                React.createElement(Markdown, { content: output || t('result_placeholder') })
                            ) :
                            React.createElement(Editor, { value: output, language: showRaw ? 'text' : langMap[promptKey].out, options: { readOnly: true, fontSize: 13, lineNumbers: 'off', wordWrap: 'on' } })
                    )
                )
            )
        );
    };

    // --- Main Page ---

    const DevToolsPage = () => {
        const [activeTab, setActiveTab] = React.useState('json-format');
        const tabs = [
            { id: 'json-format', label: t('json_format'), icon: Icons.FileJson },
            { id: 'json-diff', label: t('json_diff'), icon: Icons.GitCompare },
            { id: 'jwt', label: t('jwt'), icon: Icons.Key },
            { id: 'base64', label: t('base64'), icon: Icons.Binary },
            { id: 'timestamp', label: t('timestamp'), icon: Icons.Clock },
            { id: 'ai', label: t('ai'), icon: Icons.Sparkles },
        ];
        const components = {
            'json-format': JsonFormatter,
            'json-diff': JsonDiffer,
            'jwt': JwtDebugger,
            'base64': Base64Tool,
            'timestamp': TimestampTool,
            'ai': AIConverter
        };

        return React.createElement('div', { className: "flex h-full" },
            React.createElement('div', { className: "w-40 border-r border-border p-3 space-y-1 flex-shrink-0" },
                tabs.map(tab => React.createElement('button', {
                    key: tab.id, onClick: () => setActiveTab(tab.id),
                    className: `w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold rounded-lg transition-all ${activeTab === tab.id ? 'tab-active' : 'text-muted-foreground/80 hover:bg-muted/50'}`
                }, React.createElement(tab.icon, { className: "w-4 h-4" }), tab.label))
            ),
            React.createElement('div', { className: "flex-1 p-6 overflow-hidden flex flex-col" },
                React.createElement('div', { className: "mb-3" },
                    React.createElement('h2', { className: "text-base font-bold tracking-tight mb-0" }, tabs.find(t => t.id === activeTab).label)
                ),
                React.createElement('div', { className: "flex-1 min-h-0" }, React.createElement(components[activeTab]))
            )
        );
    };

    api.ui.registerPage({
        id: 'smart-devtools', name: t('title'), route: '/tools', component: DevToolsPage,
        icon: (props) => React.createElement('svg', { ...props, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
            React.createElement('path', { d: "m18 16 4-4-4-4" }), React.createElement('path', { d: "m6 8-4 4 4 4" }), React.createElement('path', { d: "m14.5 4-5 16" })),
        order: 6
    });
})();
