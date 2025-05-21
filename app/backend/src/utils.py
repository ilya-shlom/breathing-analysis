import os


def create_directory(dir_name: str):
    '''
    Creates directory for recordings in case of using a prefix for the first time
    '''
    if not os.path.exists(f'web_recordings/{dir_name}'):
        os.makedirs(f'web_recordings/{dir_name}')
        os.makedirs(f'web_recordings/{dir_name}/audio')
        os.makedirs(f'web_recordings/{dir_name}/graphs')


def fetch_file_data(request, input_fields: list) -> list:
    '''
    Fetches all text data about audio file
    '''
    file_data = []
    for input_field in input_fields:
        file_data.append(request.form.get(input_field))
    return file_data

def str_to_bool(val):
    return str(val).lower() in ("true", "1", "yes", "on")