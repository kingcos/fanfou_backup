import backup_json as bj


if __name__ == '__main__':
    api_key = ''
    api_secret = ''

    username = ''
    password = ''

    # 0. 构造对象
    fu = bj.FileUtil('fanfou.json')
    ff = bj.FanFou(api_key, api_secret, username, password)
    print(ff.user_id)

    # 1. 尝试获取一条信息流
    # tl = ff.request_user_timeline()
    # print(tl)

    # 2. 获取本地缓存 JSON
    content_list = fu.get_json_list()
    print(len(content_list), content_list[-1])

    # 3. 获取所有
    content_list = bj.find_all_content(ff, content_list)
    print('总计 ' + str(len(content_list)) + ' 条内容')
