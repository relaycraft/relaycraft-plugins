(function () {
    const { api, components } = RelayCraft;

    if (api.log) {
        api.log.info("Status Monitor Started");
    }

    const formatSpeed = (bytes) => {
        if (!bytes || bytes < 0) return '0 B/s';
        const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        let i = 0;
        let speed = bytes;
        while (speed >= 1024 && i < units.length - 1) {
            speed /= 1024;
            i++;
        }
        return `${speed.toFixed(speed > 10 ? 0 : 1)} ${units[i]}`;
    };

    const Icons = {
        Cpu: (props) => React.createElement('svg', { ...props, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
            React.createElement('rect', { x: "4", y: "4", width: "16", height: "16", rx: "2" }),
            React.createElement('path', { d: "M9 9h6v6H9z" }),
            React.createElement('path', { d: "M15 2v2" }), React.createElement('path', { d: "M9 2v2" }),
            React.createElement('path', { d: "M15 20v2" }), React.createElement('path', { d: "M9 20v2" }),
            React.createElement('path', { d: "M20 15h2" }), React.createElement('path', { d: "M20 9h2" }),
            React.createElement('path', { d: "M2 15h2" }), React.createElement('path', { d: "M2 9h2" })
        ),
        Memory: (props) => React.createElement('svg', { ...props, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
            React.createElement('path', { d: "M6 19v2" }), React.createElement('path', { d: "M10 19v2" }), React.createElement('path', { d: "M14 19v2" }), React.createElement('path', { d: "M18 19v2" }),
            React.createElement('path', { d: "M8 11V9" }), React.createElement('path', { d: "M16 11V9" }),
            React.createElement('rect', { x: "2", y: "5", width: "20", height: "14", rx: "2" })
        ),
        Down: (props) => React.createElement('svg', { ...props, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
            React.createElement('path', { d: "M12 5v14" }), React.createElement('path', { d: "m19 12-7 7-7-7" })
        ),
        Up: (props) => React.createElement('svg', { ...props, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
            React.createElement('path', { d: "M12 19V5" }), React.createElement('path', { d: "m5 12 7-7 7 7" })
        )
    };

    const StatusItem = ({ icon, value, color }) => React.createElement('div', { className: 'flex items-center gap-1' },
        icon && React.createElement(icon, { className: `w-3 h-3 ${color || 'text-muted-foreground'} shrink-0` }),
        React.createElement('span', {
            className: `tabular-nums tracking-tight`
        }, value)
    );

    const StatusComponent = () => {
        const [stats, setStats] = React.useState(null);
        const settings = api.settings.get() || {};
        const refreshInterval = settings.refreshInterval || 2000;

        React.useEffect(() => {
            const fetchStats = async () => {
                try {
                    const data = await api.stats.getProcessStats();
                    setStats(data);
                } catch (e) {
                    if (e && typeof e === 'string' && e.includes("Process not running")) return;
                    console.warn("Monitor Plugin: Fetch error", e);
                }
            };
            fetchStats();
            const interval = setInterval(fetchStats, refreshInterval);
            return () => clearInterval(interval);
        }, [refreshInterval]);

        if (!stats) return null;

        const memMB = (stats.memory_usage / 1024 / 1024).toFixed(0);
        const showResources = settings.showResources !== false;
        const showNetwork = settings.showNetwork !== false;

        if (!showResources && !showNetwork) return null;

        return React.createElement('div', {
            className: 'flex items-center h-7 px-3 gap-3 bg-muted/20 border border-border/40 rounded-full text-[10px] font-bold text-muted-foreground/80 transition-all hover:bg-muted/30 hover:border-border/60 cursor-default select-none'
        },
            // CPU & Memory Group
            showResources && React.createElement(React.Fragment, null,
                React.createElement(StatusItem, {
                    icon: Icons.Cpu,
                    value: `${stats.cpu_usage.toFixed(0)}%`,
                    color: stats.cpu_usage > 50 ? 'text-orange-500' : 'text-blue-400'
                }),
                React.createElement(StatusItem, {
                    icon: Icons.Memory,
                    value: `${memMB}MB`
                })
            ),
            // Divider
            (showResources && showNetwork) && React.createElement('div', { className: 'w-px h-2.5 bg-border/40' }),
            // Network Group
            showNetwork && React.createElement(React.Fragment, null,
                React.createElement(StatusItem, {
                    icon: Icons.Down,
                    value: formatSpeed(stats.rx_speed),
                    color: stats.rx_speed > 0 ? 'text-green-500/80' : ''
                }),
                React.createElement(StatusItem, {
                    icon: Icons.Up,
                    value: formatSpeed(stats.tx_speed),
                    color: stats.tx_speed > 0 ? 'text-emerald-500/80' : ''
                })
            )
        );
    };

    api.ui.registerSlot('status-bar-right', {
        component: StatusComponent,
        order: 10
    });

    api.ui.toast(api.ui.t('title') + " Active", "success");
})();
