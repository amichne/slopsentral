"""A small application whose behavior has a source-linked explanation."""


def greeting(name: str) -> str:
    return f"Hello, {name}."


if __name__ == "__main__":
    print(greeting("reader"))
