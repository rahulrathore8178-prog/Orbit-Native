import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// 1. Define the shape of a single message
interface Message {
  id: string;
  text: string;
  sender: string;
  time: string;
}

// 2. Define the slice state type
interface ChatState {
  messages: Message[];
  input: string;
  loading: boolean;
}

// 3. Initial state with type safety
const initialState: ChatState = {
  messages: [],
  input: '',
  loading: true,
};

// 4. Create slice with typed reducers
const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },
    clearMessages: (state) => {
      state.messages = [];
    },
    setChatLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setInput: (state, action: PayloadAction<string>) => {
      state.input = action.payload;
    }
  },
});

// 5. Export actions and reducer
export const { addMessage, clearMessages, setInput, setChatLoading } = chatSlice.actions;
export default chatSlice.reducer;
