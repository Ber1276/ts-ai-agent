const fs = require('fs');
const path = 'packages/frontend/src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. replace empty state
content = content.replace(
    /\{\s*messages\.length === 0 && \(\s*<div className="rounded-2xl border border-dashed border-border bg-background\/80 p-6 text-sm text-muted-foreground">\s*输入问题后发送，右侧会展示流式输出，左侧上传的文档将参与检索。\s*<\/div>\s*\)\s*\}/,
    `{messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center p-12 text-center animate-fade-up h-full">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4 ring-1 ring-primary/20">
                                        <Sparkles className="h-8 w-8 text-primary" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-foreground mb-2">欢迎使用 Knowledge Assistant</h3>
                                    <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
                                        您可以直接在下方输入问题开始对话，或者先在左侧配置模型和知识库，系统将自动进行内容索引并协助推理。
                                    </p>
                                </div>
                            )}`
);

// 2. add animate-fade-up to chat bubbles
content = content.replace(
    /className={`w-fit max-w-\[85%\] rounded-3xl px-5 py-4 text-\[15px\] leading-relaxed shadow-sm \$\{/g,
    'className={`w-fit max-w-[85%] animate-fade-up rounded-3xl px-5 py-4 text-[15px] leading-relaxed shadow-sm ${'
);

// 3. remove the ugly blue/orange scrollbar from index.css (I already did it but just double checking)

fs.writeFileSync(path, content);
