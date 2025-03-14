// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ERC20Token {
  string name;
  string symbol;
  uint8 decimals;
  address admin;
  mapping(address => mapping(address => uint256)) allowances; // owner, spender
  mapping(address => uint256) private balances;
  mapping(address => bool) private pausers;
  mapping(address => bool) private minters;
  uint256 supply;
  uint256 MAX_SUPPLY = 2000000000 * 1e18;  // 2 bilions
  bool isPaused;

  constructor (string memory _name, string memory _symbol, uint8 _decimals) {
    name = _name; // name of token vd 'Ethereum'
    symbol = _symbol; // symbol of the token vd 'ETH'
    decimals = _decimals; // decimal places or smallest unit a token can be divided to (usually 18 for erc20)
    admin = msg.sender;
    pausers[msg.sender] = true;
    minters[msg.sender] = true;
  }

  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
  event Mint(address indexed to, uint256 value);
  event Burn(address indexed from, uint256 value);
  event Paused(address indexed account);
  event UnPaused(address indexed account);

  modifier onlyAdmin() {
    require(msg.sender == admin, "Not admin");
    _;
  }

  modifier onlyPauser() {
    require(pausers[msg.sender] == true, "Not pauser");
    _;
  }

  modifier onlyMinter() {
    require(minters[msg.sender] == true, "Not minter");
    _;
  }

  modifier checkIsPaused() {
    require(!isPaused, "Contract is paused");
    _;
  }

  function totalSupply() public view returns (uint256) {
    return supply;
  }

  function balanceOf(address account) public view returns (uint256) {
    return balances[account];
  }

  function approve(address spender, uint256 amount) public returns (bool) {
    allowances[msg.sender][spender] = amount;
    return true;
  }

  function allowance(address owner, address spender) public view returns (uint256) {
    return allowances[owner][spender];
  }

  function transfer(address recipient, uint256 amount) public checkIsPaused returns (bool) {
    require(balances[msg.sender] >= amount, "Insufficient balance");
    balances[msg.sender] -= amount;
    balances[recipient] += amount;
    emit Transfer(msg.sender, recipient, amount);
    return true;
  }

  function transferFrom(address sender, address recipient, uint256 amount) public checkIsPaused returns (bool) {
    require(balances[sender] >= amount, "Insufficient balance");
    require(allowances[sender][msg.sender] >= amount, "Allowance exceeded");
    allowances[sender][msg.sender] -= amount;
    balances[sender] -= amount;
    balances[recipient] += amount;
    return true;
  }

  function mint(address account, uint256 amount) public onlyMinter checkIsPaused {
    require(supply + amount <= MAX_SUPPLY, "Max_suplly exceeded");
    supply += amount;
    balances[account] += amount;
  }

  function burn(uint256 amount) public checkIsPaused {
    require(balances[msg.sender] >= amount, "Insufficient balance");
    balances[msg.sender] -= amount;
    supply -= amount;
  }

  function pause() public onlyPauser {
    isPaused = true;
    emit Paused(msg.sender);
  }

  function unPause() public onlyPauser {
    isPaused = false;
    emit UnPaused(msg.sender);
  }

  function setPauser(address account, bool status) public onlyAdmin {
    pausers[account] = status;
  }

  function setMinter(address account, bool status) public onlyAdmin {
    minters[account] = status;
  }
}