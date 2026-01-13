import { createSlice } from "@reduxjs/toolkit"

const eventSlice = createSlice({
  name: "events",
  initialState: {
    events: [],
    selectedEvent: null,
    loading: false,
  },
  reducers: {
    setEvents: (state, action) => {
      state.events = action.payload
    },
    selectEvent: (state, action) => {
      state.selectedEvent = action.payload
    },
    setLoading: (state, action) => {
      state.loading = action.payload
    },
  },
})

export const { setEvents, selectEvent, setLoading } = eventSlice.actions
export default eventSlice.reducer
