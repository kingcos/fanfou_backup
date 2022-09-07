import os
import re
import sys
import json
import time
import oauth2
import urllib
import datetime
import requests


class FanFou:
    host = "fanfou.com"

    def __init__(self, api_key, api_secret, username, password, user_id=''):
        self.api_key = api_key
        self.api_secret = api_secret
        self.token, self.token_secret = self.login(username, password)
        if user_id == '':
            self.user_id = self.get_current_user_id()

    def login(self, username, password):
        print('------ login ------')
        params = {'x_auth_username': username, 'x_auth_password': password, 'x_auth_mode': 'client_auth'}
        url = "http://fanfou.com/oauth/access_token?{}".format(urllib.parse.urlencode(params))

        consumer = oauth2.Consumer(self.api_key, self.api_secret)
        client = oauth2.Client(consumer)
        client.add_credentials(username, password)
        client.set_signature_method(oauth2.SignatureMethod_HMAC_SHA1())
        resp, token_bytes = client.request(url)
        tokens = dict(urllib.parse.parse_qsl(token_bytes.decode("utf-8")))

        if len(tokens) == 2:
            return tokens['oauth_token'], tokens['oauth_token_secret']
        else:
            print('登录失败！')
            exit(-1)

    def get_current_user_id(self):
        print('------ get_current_user_id ------')
        url = 'http://api.fanfou.com/account/verify_credentials.json'
        params = {'mode': 'lite'}

        consumer = oauth2.Consumer(self.api_key, self.api_secret)
        token = oauth2.Token(self.token, self.token_secret)
        client = oauth2.Client(consumer, token)

        response, content = client.request(url, method='POST', body=urllib.parse.urlencode(params))
        result = json.loads(content)
        return result['id']

    def request_user_timeline(self, max_id='', count=1):
        print('------ request_user_timeline ------')
        url = f"http://api.fanfou.com/statuses/user_timeline.json?id={self.user_id}&count={count}&format=html"
        if len(max_id):
            url = f"http://api.fanfou.com/statuses/user_timeline.json?max_id={max_id}&id={self.user_id}&count={count}&format=html"

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


def find_all_content(ff, content_list=[], append_list=[], count=40):
    max_id = append_list[0]['id'] if len(append_list) > 0 else ''
    max_id_to = content_list[-1]['id'] if len(content_list) > 0 else ''

    time.sleep(5)
    ts = ff.request_user_timeline(count=count, max_id=max_id)

    content_list_ids = list(map(lambda x: x['id'], content_list))
    append_list_ids = list(map(lambda x: x['id'], append_list))  # 1, 2, 3，时间正序（旧 -> 新）

    for t in ts:
        # 删除 user 字段（重复率太高）
        del t['user']
        # 处理【审核中】
        verified_text = ' 【审核中】'
        if t['text'].endswith(verified_text):
            t['text'] = re.sub(re.escape(verified_text) + '$', '', t['text'])  # t['text'].strip(verified_text)

        if len(max_id_to) and t['id'] == max_id_to:
            # 有目标 max_id 且命中到 max_id_to
            content_list.extend(append_list)
            return content_list

        if t['id'] not in content_list_ids and t['id'] not in append_list_ids:
            ff.download_image(t, './img')
            append_list.insert(0, t)

    if len(ts) < count:
        # 到达尾部
        return append_list

    return find_all_content(ff, content_list, append_list, count)


if __name__ == '__main__':
    api_key = os.environ['API_KEY']
    api_secret = os.environ['API_SECRET']

    username = os.environ['USERNAME']
    password = os.environ['PASSWORD']

    # 0.1 获取 user_id
    user_id = sys.argv[1] if len(sys.argv) > 1 else ''

    # 0.2 构造对象
    fu = FileUtil('fanfou.json')
    ff = FanFou(api_key, api_secret, username, password, user_id)


    # 1. 读取原文件内容
    content_list = fu.get_json_list()
    # print(content_list)

    # 2. 添加完整内容
    content_list = find_all_content(ff, content_list)
    print('总计 ' + str(len(content_list)) + ' 条内容')

    # 3. 写回文件，再读取
    fu.write_list_to_file(content_list)
    content_list = fu.get_json_list()
    print('已写入总计 ' + str(len(content_list)) + ' 条内容')
    # print(content_list)
