import { createSlice } from "@reduxjs/toolkit";

const discoverSlice = createSlice({
    name: "discover",
    initialState: { nearbyUsers: [], loading: false, error: null },
    reducers: {
        fetchNearbyStart: (state) => { state.loading = true; state.error = null; },
        fetchNearbySuccess: (state, action) => {
            state.loading = false;
            state.nearbyUsers = action.payload;
        },
        fetchNearbyFailure: (state, action) => {
            state.loading = false;
            state.error = action.payload;
        },
    },
});

export const {fetchNearbySuccess, fetchNearbyStart, fetchNearbyFailure} = discoverSlice.actions;
export default discoverSlice.reducer;