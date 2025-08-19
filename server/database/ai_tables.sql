-- AI Conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Messages table
CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type VARCHAR(10) CHECK (type IN ('user', 'ai')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated_at ON ai_conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_user_id ON ai_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at);

-- RLS Policies for ai_conversations
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations" ON ai_conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations" ON ai_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON ai_conversations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON ai_conversations
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for ai_messages
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages" ON ai_messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages" ON ai_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" ON ai_messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" ON ai_messages
    FOR DELETE USING (auth.uid() = user_id);
