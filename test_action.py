import os
import sys
import json
import oauth2
import datetime
import requests


class FanFou:
    host = "fanfou.com"

    def __init__(self, api_key, api_secret, token, token_secret):
        self.api_key = api_key
        self.api_secret = api_secret
        self.token = token
        self.token_secret = token_secret

    def request_user_timeline(self, _id, max_id='', count=1):
        print('------ request_user_timeline ------')
        url = f"http://api.fanfou.com/statuses/user_timeline.json?id={_id}&count={count}&format=html"
        if len(max_id):
            url = f"http://api.fanfou.com/statuses/user_timeline.json?max_id={max_id}&id={_id}&count={count}&format=html"

        consumer = oauth2.Consumer(self.api_key, self.api_secret)
        token = oauth2.Token(self.token, self.token_secret)
        client = oauth2.Client(consumer, token)

        response, content = client.request(url)
        # print(response)
        return json.loads(content)

    def download_image(self, t, image_folder='img'):
        if 'photo' not in t:
            return

        url = t['photo']['largeurl']
        date = datetime.datetime.strptime(t['created_at'], '%a %b %d %H:%M:%S %z %Y')
        folder_name = datetime.datetime.strftime(date, '%Y%m%d')
        file_name = os.path.basename(url)

        if os.path.exists(f'{image_folder}/{folder_name}/{file_name}'):
            return

        os.makedirs(f'{image_folder}/{folder_name}', exist_ok=True)
        r = requests.get(url)
        with open(f'{image_folder}/{folder_name}/{file_name}', 'wb') as f:
            f.write(r.content)


class FileUtil:
    path = ""  # 文件路径

    def __init__(self, path):
        self.path = path

        # 如果文件不存在，创建文件并写入 []
        if not os.path.exists(path):
            with open(path, 'w', encoding='utf-8') as f:
                f.write('[]')

    def get_json_list(self):
        print('------ get_json_list ------')
        if len(self.path) == 0:
            print("请设置路径！")
            exit(-1)

        # 如果文件为空，返回 []，否则读取文件并返回
        with open(self.path, 'r', encoding='utf-8') as f:
            c = f.read()
            if len(c) == 0:
                c = '[]'
            return json.loads(c)

    def write_list_to_file(self, content_list):
        print('------ write_list_to_file ------')

        if len(self.path) == 0:
            print("请设置路径！")
            exit(-1)

        if len(content_list) == 0:
            print("请设置内容！")
            exit(-1)

        with open(self.path, 'w', encoding='utf-8') as f:
            content = json.dumps(content_list)
            f.write(content)


def find_all_content(ff, _id, content_list=[], append_list=[], count=40):
    max_id = append_list[0]['id'] if len(append_list) > 0 else ''

    ts = ff.request_user_timeline(_id=_id, count=count, max_id=max_id)
    return ts


if __name__ == '__main__':
    # 0. 参数校验
    if len(sys.argv) != 7:
        print("参数个数有误！")
        exit(-1)

    api_key = sys.argv[1]
    api_secret = sys.argv[2]

    token = sys.argv[3]
    token_secret = sys.argv[4]

    user_id = sys.argv[5]

    # 0.1 测试
    test_token = sys.argv[6]
    print(test_token)

    # 0.2 构造对象
    fu = FileUtil('fanfou.json')
    ff = FanFou(api_key, api_secret, token, token_secret)

    # 1. 读取原文件内容
    content_list = fu.get_json_list()
    print(content_list)

    # 2. 添加完整内容
    content_list = find_all_content(ff, _id=user_id, content_list=content_list, count=2)
    print(content_list)

    # 3. 写回文件，再读取
    fu.write_list_to_file(content_list)
    content_list = fu.get_json_list()
    print(content_list)
