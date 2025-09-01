"""Setup configuration for Configuration Manager Python client."""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="configuration-manager-client",
    version="2.0.0",
    author="Configuration Manager Team",
    author_email="team@configurationmanager.com",
    description="Python client library for Configuration Manager service",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/configuration-manager/python-client",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: System :: Systems Administration",
        "Topic :: Internet :: WWW/HTTP :: HTTP Servers",
    ],
    python_requires=">=3.8",
    install_requires=requirements,
    extras_require={
        "dev": [
            "pytest>=6.0",
            "pytest-asyncio>=0.21.0",
            "pytest-cov>=4.0.0",
            "black>=22.0.0",
            "isort>=5.10.0",
            "mypy>=1.0.0",
            "flake8>=5.0.0",
        ],
        "docs": [
            "sphinx>=4.0.0",
            "sphinx-rtd-theme>=1.0.0",
        ]
    },
    keywords=[
        "configuration",
        "management", 
        "client",
        "api",
        "rest",
        "http",
        "files",
        "upload",
        "download"
    ],
    project_urls={
        "Bug Reports": "https://github.com/configuration-manager/python-client/issues",
        "Source": "https://github.com/configuration-manager/python-client",
        "Documentation": "https://configuration-manager-python-client.readthedocs.io/",
    },
)
