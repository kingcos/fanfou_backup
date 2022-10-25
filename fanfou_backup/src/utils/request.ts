import axios from "axios";

const request = axios.create({});

// const request = axios.create({
//   timeout: 5000,
// });

// request.interceptors.response.use(
//   (res) => {
//     return res;
//   },
//   (e) => {
//     return Promise.reject(e.response.data.message);
//   }
// );

export default request;
