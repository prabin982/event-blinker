import { configureStore } from "@reduxjs/toolkit"
import authSlice from "./authSlice"
import eventSlice from "./eventSlice"

export default configureStore({
  reducer: {
    auth: authSlice,
    events: eventSlice,
  },
})
