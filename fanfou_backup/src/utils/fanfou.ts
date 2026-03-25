import request from "../utils/request";

export interface Fanfou {
  created_at: string;
  text: string;
  location: string;
  photo?: {
    largeurl: string;
  };
  repost_status?: {
    created_at: string;
    text: string;
    photo?: {
      largeurl: string;
    };
    user: {
      name: string;
    };
  };
}

const DATA_URL = "https://raw.githubusercontent.com/kingcos/fanfou_backup/main/fanfou.json";

// Extract the GitHub repo owner from the URL as the fanfou account name
export const FANFOU_OWNER = DATA_URL.split("/")[3];

export function requestFanfous(): Promise<Fanfou[]> {
  return request
    .get<Fanfou[]>(DATA_URL)
    .then((response) => {
      if (response.data instanceof Array) {
        return response.data;
      }
      return Promise.reject(new Error("Invalid data format"));
    });
}
