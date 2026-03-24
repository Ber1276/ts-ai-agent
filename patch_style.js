const fs = require('fs');
const path = 'packages/frontend/src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
    /className="overflow-hidden rounded-3xl border border-border\/70 bg-background\/95 p-7 shadow-\[0_20px_46px_-28px_rgba\(15,23,42,0\.52\)\] backdrop-blur"/,
    'className="overflow-hidden rounded-3xl border border-border/70 bg-background/95 p-7 shadow-sm backdrop-blur"'
);

content = content.replace(
    /className="flex min-h-\[780px\] flex-col overflow-hidden rounded-3xl border border-border\/70 bg-background\/95 shadow-\[0_22px_50px_-28px_rgba\(15,23,42,0\.5\)\] backdrop-blur"/,
    'className="flex min-h-[780px] flex-col overflow-hidden rounded-3xl border border-border/70 bg-background/95 shadow-sm backdrop-blur"'
);

content = content.replace(
    /bg-\[linear-gradient\(180deg,rgba\(255,255,255,0\.95\)_0%,rgba\(240,249,255,0\.8\)_65%,rgba\(255,247,237,0\.7\)_100%\)\]/,
    'bg-muted/20'
);

content = content.replace(
    /className={`max-w-\[92%\] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-\[0_10px_18px_-16px_rgba\(15,23,42,0\.65\)\] \${\n\s*msg\.role === "user"\n\s*\? "ml-auto border-amber-200\/80 bg-amber-50\/85"\n\s*: "border-sky-200\/80 bg-sky-50\/90"\n\s*}`}/g,
    'className={`w-fit max-w-[85%] rounded-3xl px-5 py-4 text-[15px] leading-relaxed shadow-sm ${\n                                        msg.role === "user"\n                                            ? "ml-auto bg-primary text-primary-foreground rounded-br-sm border border-primary/20"\n                                            : "border border-border/50 bg-background rounded-bl-sm"\n                                    }`}'
);

fs.writeFileSync(path, content);
