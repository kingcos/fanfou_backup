import request from "../utils/request";

export interface Fanfou {
  created_at: string;
  text: string;
  location: string;
  photo: {
    largeurl: string;
  };
  repost_status: {
    created_at: string;
    text: string;
    photo: {
      largeurl: string;
    };
    user: {
      name: string;
    };
  };
}

export function requestFanfous(): Promise<Fanfou[]> {
  return new Promise<Fanfou[]>((resolve, reject) => {
    request
      .get<Fanfou[]>(
        "https://raw.githubusercontent.com/kingcos/fanfou_backup/main/fanfou.json"
      )
      .then((response) => {
        if (response.data instanceof Array) {
          resolve(response.data);
        } else {
          reject();
        }
      })
      .catch((err) => {
        console.log(err);
        reject(err);
      });
  });
}
