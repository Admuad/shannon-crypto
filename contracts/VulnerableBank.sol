// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Vulnerable Bank Contract for Testing
 * Contains multiple known vulnerabilities for Shannon Crypto to detect
 */

contract VulnerableBank {
    mapping(address => uint256) public balances;
    bool private locked;

    event Deposit(address indexed from, uint256 amount);
    event Withdraw(address indexed to, uint256 amount);

    // VULNERABILITY 1: Reentrancy
    // Missing non-reentrant modifier on external function that calls external contract

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");

        (bool success, ) = msg.sender.call{value: amount}(""); // Call external contract
        require(success, "Call failed");

        balances[msg.sender] -= amount; // State change AFTER external call (reentrancy!)
    }

    // VULNERABILITY 2: Integer Overflow
    function unsafeAdd(uint256 a, uint256 b) public pure returns (uint256) {
        return a + b; // No overflow check
    }

    // VULNERABILITY 3: Unchecked Return Value
    function deposit() external payable {
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    // VULNERABILITY 4: Access Control - Anyone can call
    function emergencyWithdraw() external {
        msg.sender.transfer(address(this).balance); // No access control!
    }

    // VULNERABILITY 5: Timestamp Dependence
    function lottery() external view returns (uint256) {
        uint256 winningNumber = uint256(block.timestamp) % 10;
        return winningNumber;
    }

    // Safe functions for comparison
    function safeWithdraw(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }

    modifier nonReentrant() {
        require(!locked, "Reentrancy guard");
        locked = true;
        _;
        locked = false;
    }

    receive() external payable {
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }
}
