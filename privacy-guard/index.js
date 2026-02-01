(function () {
    const { React } = window;
    const { api } = RelayCraft;

    // Destructure Native Components
    const { Switch } = RelayCraft.components || {};

    // Helper for safe translation
    const t = (k, opts) => (api.ui && api.ui.t) ? api.ui.t(k, opts) : k;

    const PrivacyGuardSettings = () => {
        const [settings, setSettings] = React.useState({
            active: true,
            block_email: true,
            block_phone: true
        });

        // Language listener for dynamic updates
        const [lang, setLang] = React.useState('en');
        React.useEffect(() => {
            if (api.ui && api.ui.onLanguageChange) {
                return api.ui.onLanguageChange(l => setLang(l));
            }
        }, []);

        React.useEffect(() => {
            const load = async () => {
                const s = await api.settings.get();
                if (s && Object.keys(s).length > 0) {
                    setSettings(s);
                }
            };
            load();
        }, []);

        const updateSetting = async (key, value) => {
            const newSettings = { ...settings, [key]: value };
            setSettings(newSettings);
            await api.settings.save(newSettings);
            if (api.log) api.log.info(`Updated setting: ${key} = ${value}`);
            api.ui.toast(t('toast_saved'), "success");
        };

        const ToggleRow = ({ label, checked, onChange, disabled }) => (
            React.createElement('div', { className: `flex items-center justify-between p-2.5 rounded-xl border bg-card/50 border-border/40 ${disabled ? 'opacity-50 pointer-events-none' : ''}` },
                React.createElement('span', { className: 'text-[13px] font-medium' }, label),
                React.createElement(Switch, {
                    checked: checked,
                    onCheckedChange: onChange,
                    disabled: disabled
                })
            )
        );

        return React.createElement('div', { className: 'p-5 max-w-lg space-y-4' },
            React.createElement('div', { className: 'space-y-1.5' },
                React.createElement('h2', { className: 'text-lg font-bold flex items-center gap-2' },
                    t('title'),
                    React.createElement('span', { className: 'text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider' }, t('beta'))
                ),
                React.createElement('p', { className: 'text-muted-foreground/80 text-[11px] leading-relaxed' },
                    t('description')
                )
            ),

            React.createElement('div', { className: 'grid gap-4' },
                React.createElement('div', {},
                    React.createElement('h3', { className: 'text-sm font-semibold mb-3' }, t('master_switch')),
                    ToggleRow({
                        label: t('enable'),
                        checked: settings.active,
                        onChange: (v) => updateSetting('active', v)
                    })
                ),

                React.createElement('div', { className: `space-y-3` },
                    React.createElement('h3', { className: 'text-sm font-semibold mb-3' }, t('rules')),
                    ToggleRow({
                        label: t('rule_email'),
                        checked: settings.block_email,
                        onChange: (v) => updateSetting('block_email', v),
                        disabled: !settings.active
                    }),
                    ToggleRow({
                        label: t('rule_phone'),
                        checked: settings.block_phone,
                        onChange: (v) => updateSetting('block_phone', v),
                        disabled: !settings.active
                    })
                )
            ),

            React.createElement('div', { className: 'bg-primary/5 border border-primary/10 p-3 rounded-xl' },
                React.createElement('p', { className: 'text-[11px] text-muted-foreground/80 leading-relaxed' },
                    t('note')
                )
            )
        );
    };

    api.ui.registerPage({
        id: 'privacy-guard',
        name: t('title'),
        title: 'Privacy Guard',
        component: PrivacyGuardSettings,
        icon: (props) => React.createElement('svg', { ...props, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" },
            React.createElement('path', { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" })
        )
    });
})();
