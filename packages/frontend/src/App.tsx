import { Routes, Route, Navigate } from "react-router-dom";
import { RootLayout } from "./components/layout/RootLayout";
import { ChatPage } from "./pages/ChatPage";
import { ModelsPage } from "./pages/ModelsPage";
import { KnowledgePage } from "./pages/KnowledgePage";

function App() {
    return (
        <Routes>
            <Route element={<RootLayout />}>
                {/* 默认跳转到聊天页面 */}
                <Route index element={<ChatPage />} />

                {/* 模型管理路由 */}
                <Route path="models" element={<ModelsPage />} />

                {/* 知识库管理路由 */}
                <Route path="knowledge" element={<KnowledgePage />} />

                {/* 通配符跳转 */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}

export default App;
