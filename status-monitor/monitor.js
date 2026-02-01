(function () {
    const { React } = window;
    const { api } = RelayCraft;

    console.log("Monitor Plugin: Initializing...", {
        hasT: !!(api.ui && api.ui.t),
        language: api.ui && api.ui.language
    });

    if (api.log) {
        api.log.info("Status Monitor Started");
    }

    const StatusComponent = () => {
        const [stats, setStats] = React.useState(null);
        // Fallback for safety
        const safeLang = (api.ui && api.ui.language) || 'en';
        const [lang, setLang] = React.useState(safeLang);

        // Get initial settings
        const settings = api.settings.get() || {};
        const refreshInterval = settings.refreshInterval || 2000;
        const showCpu = settings.showCpu !== false;
        const showMemory = settings.showMemory !== false;

        // Listen for language changes
        React.useEffect(() => {
            if (api.ui && api.ui.onLanguageChange) {
                return api.ui.onLanguageChange((newLang) => {
                    console.log("Monitor Plugin: Language changed to", newLang);
                    setLang(newLang);
                });
            }
        }, []);

        React.useEffect(() => {
            const fetchStats = async () => {
                try {
                    const data = await api.stats.getProcessStats();
                    setStats(data);
                } catch (e) {
                    if (e && e.includes && e.includes("Process not running")) {
                        // Suppress expected startup error
                        return;
                    }
                    console.warn("Failed to fetch stats:", e);
                }
            };

            fetchStats();
            const interval = setInterval(fetchStats, refreshInterval);

            if (api.log) {
                api.log.info(`Monitor configured with refresh interval: ${refreshInterval}ms`);
            }

            return () => clearInterval(interval);
        }, [refreshInterval]);

        if (!stats) return null;

        const memMB = (stats.memory_usage / 1024 / 1024).toFixed(0);

        // Modern Pill Design
        return React.createElement('div', {
            className: 'flex items-center h-6 px-3 gap-3 bg-muted/10 border border-border/40 rounded-full text-[10px] font-medium text-muted-foreground transition-all hover:bg-muted/20 hover:border-border/60 cursor-default select-none'
        },
            // Title for tooltip or just internal tracking
            showCpu && React.createElement('div', { className: 'flex items-center gap-1.5' },
                React.createElement('div', { className: 'relative flex items-center justify-center w-2 h-2' },
                    React.createElement('span', { className: `absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${stats.cpu_usage > 50 ? 'bg-red-400' : 'bg-green-400'}` }),
                    React.createElement('span', { className: `relative inline-flex rounded-full h-1.5 w-1.5 ${stats.cpu_usage > 50 ? 'bg-red-500' : 'bg-green-500'}` })
                ),
                React.createElement('span', { className: 'tabular-nums tracking-tight' }, `${api.ui.t('cpu')}: ${stats.cpu_usage.toFixed(0)}%`)
            ),
            (showCpu && showMemory) && React.createElement('div', { className: 'w-px h-2.5 bg-border/50' }),
            showMemory && React.createElement('div', { className: 'flex items-center gap-1.5' },
                React.createElement('span', { className: 'tabular-nums tracking-tight' }, `${api.ui.t('memory')}: ${memMB} MB`)
            )
        );
    };

    api.ui.registerSlot('status-bar-right', {
        component: StatusComponent,
        order: 10
    });

    api.ui.toast(api.ui.t('title') + " Active", "success");
})();
